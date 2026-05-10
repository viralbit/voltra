/**
 * VOLTRA — Intelligent Storage Manager
 *
 * - Monitors total disk usage every 10 minutes
 * - Triggers smart cleanup when usage >= THRESHOLD_GB (default 4 GB)
 * - Periodic light sweep of temp/cache files (>1h old)
 * - Daily log rotation: deletes logs older than 24h
 * - Smart prioritization: oldest + largest first
 * - HARD-PROTECTED paths: sessions, auth, creds, databases, configs, settings
 * - Never crashes the bot — fully error-handled, async, leak-free
 *
 * Usage:
 *   const { startCleanup, cleanupAfterSend, getStorageStats } = require('./utils/cleanup');
 *   startCleanup();
 *   await cleanupAfterSend('/tmp/foo.mp3');
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');

let getTempDir = () => path.join(process.cwd(), 'temp');
try { ({ getTempDir } = require('./tempManager')); } catch (_) {}

let SESSION_DIR_NAME = 'session';
try { SESSION_DIR_NAME = require('../config').sessionName || 'session'; } catch (_) {}

const ROOT = process.cwd();

// ────────────────── CONFIG ──────────────────
const CHECK_INTERVAL_MS    = 10 * 60 * 1000;        // every 10 min
const TEMP_FILE_MAX_AGE_MS = 60 * 60 * 1000;        // 1 hour
const LOG_FILE_MAX_AGE_MS  = 24 * 60 * 60 * 1000;   // 24 hours
const THRESHOLD_BYTES      = 4 * 1024 * 1024 * 1024;// 4 GB
const TARGET_FREE_BYTES    = 1.5 * 1024 * 1024 * 1024; // free ~1.5GB after cleanup

// Folders that are SAFE to clean (relative to project root or absolute)
const JUNK_DIRS = [
  'tmp', 'temp', 'cache', '.cache',
  'downloads', 'media', 'stickers', 'logs',
  'node_modules/.cache',
  os.tmpdir(),
];

// Anything matching these names ANYWHERE in the path is OFF-LIMITS
const PROTECTED_NAMES = new Set([
  SESSION_DIR_NAME, 'session', 'sessions', 'auth', 'auth_info',
  'auth_info_baileys', 'baileys_auth_info', 'creds.json',
  'database', 'databases', 'data', 'db',
  'settings', 'config', 'config.js', 'config.json',
  '.env', '.env.local', '.env.production',
  'users.json', 'groups.json', 'accounts.json',
  'premium.json', 'owner.json', 'economy.json',
  'levels.json', 'xp.json', 'antilink.json',
  'antidelete.json', 'antibadword.json',
  'welcome.json', 'goodbye.json',
  'mongo', 'mongodb',
]);

// Filename patterns that are protected anywhere
const PROTECTED_PATTERNS = [
  /creds\.json$/i, /\.env(\..+)?$/i, /^app-creds/i,
  /\.session$/i, /\.keys$/i,
];

// ────────────────── UTILS ──────────────────
const fmtBytes = (b) => {
  if (!b || b < 0) return '0 B';
  const u = ['B','KB','MB','GB','TB']; let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(2)} ${u[i]}`;
};

const log = (msg) => console.log(`🧹 [Storage] ${msg}`);

function isProtected(p) {
  const norm = path.resolve(p);
  const parts = norm.split(path.sep);
  for (const part of parts) {
    if (PROTECTED_NAMES.has(part)) return true;
  }
  const base = path.basename(norm);
  if (PROTECTED_PATTERNS.some((re) => re.test(base))) return true;
  return false;
}

async function safeStat(p) {
  try { return await fsp.lstat(p); } catch { return null; }
}

// Recursively collect cleanable files with metadata
async function collectFiles(dir, out = []) {
  if (isProtected(dir)) return out;
  let entries;
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); }
  catch { return out; }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (isProtected(full)) continue;
    try {
      if (entry.isDirectory()) {
        await collectFiles(full, out);
      } else if (entry.isFile()) {
        const st = await safeStat(full);
        if (!st) continue;
        out.push({ path: full, size: st.size, mtime: st.mtimeMs });
      }
    } catch (_) { /* skip locked/in-use files */ }
  }
  return out;
}

async function tryUnlink(p) {
  try { await fsp.unlink(p); return true; }
  catch (e) {
    // EBUSY / EPERM / ENOENT → file in use or already gone, ignore
    return false;
  }
}

async function removeEmptyDirs(dir) {
  if (isProtected(dir)) return;
  let entries;
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const sub = path.join(dir, entry.name);
      if (isProtected(sub)) continue;
      await removeEmptyDirs(sub);
    }
  }
  try {
    const left = await fsp.readdir(dir);
    if (left.length === 0 && path.resolve(dir) !== ROOT) {
      await fsp.rmdir(dir).catch(() => {});
    }
  } catch (_) {}
}

// ────────────────── DISK USAGE ──────────────────
// Folders to skip when measuring usage. node_modules, sessions and .git
// are huge / important and we never delete from them anyway, so skipping
// them keeps the periodic check fast and safe on Render's slow disk.
const SIZE_SKIP = new Set([
  'node_modules', '.git', '.cache',
  SESSION_DIR_NAME, 'session', 'sessions',
  'auth', 'auth_info', 'auth_info_baileys', 'baileys_auth_info',
  'database', 'data', 'db',
]);
async function dirSize(dir) {
  let total = 0;
  let stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try { entries = await fsp.readdir(d, { withFileTypes: true }); }
    catch { continue; }
    for (const e of entries) {
      if (SIZE_SKIP.has(e.name)) continue;
      const full = path.join(d, e.name);
      try {
        if (e.isDirectory()) stack.push(full);
        else if (e.isFile()) {
          const st = await fsp.lstat(full);
          total += st.size;
        }
      } catch (_) {}
    }
  }
  return total;
}

async function getStorageStats() {
  const used = await dirSize(ROOT);
  return {
    usedBytes: used,
    usedHuman: fmtBytes(used),
    thresholdBytes: THRESHOLD_BYTES,
    thresholdHuman: fmtBytes(THRESHOLD_BYTES),
    pct: (used / THRESHOLD_BYTES * 100).toFixed(1) + '%',
  };
}

// ────────────────── CLEANUP ROUTINES ──────────────────
function junkRoots() {
  const roots = new Set();
  try { roots.add(getTempDir()); } catch (_) {}
  for (const j of JUNK_DIRS) {
    const abs = path.isAbsolute(j) ? j : path.join(ROOT, j);
    if (fs.existsSync(abs)) roots.add(abs);
  }
  return Array.from(roots);
}

// Light periodic sweep — temp >1h, logs >24h
async function lightSweep() {
  const now = Date.now();
  let deleted = 0, freed = 0;
  for (const root of junkRoots()) {
    const files = await collectFiles(root);
    for (const f of files) {
      const isLog = /\.log(\.\d+)?$/i.test(f.path) || /[\\/]logs[\\/]/i.test(f.path);
      const maxAge = isLog ? LOG_FILE_MAX_AGE_MS : TEMP_FILE_MAX_AGE_MS;
      if (now - f.mtime > maxAge) {
        if (await tryUnlink(f.path)) { deleted++; freed += f.size; }
      }
    }
    await removeEmptyDirs(root);
  }
  if (deleted > 0) log(`Light sweep: deleted ${deleted} file(s), freed ${fmtBytes(freed)}`);
}

// Aggressive cleanup — triggered when threshold exceeded
async function aggressiveCleanup(stats) {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log(`⚠️  Disk usage ${stats.usedHuman} >= ${stats.thresholdHuman} — starting smart cleanup`);

  const all = [];
  for (const root of junkRoots()) {
    const files = await collectFiles(root);
    all.push(...files);
  }
  // Sort: oldest first, then largest first within similar age buckets
  all.sort((a, b) => {
    const ageDiff = a.mtime - b.mtime;       // older first
    if (Math.abs(ageDiff) > 5 * 60 * 1000) return ageDiff;
    return b.size - a.size;                  // larger first
  });

  const targetBytes = Math.max(0, stats.usedBytes - (stats.thresholdBytes - TARGET_FREE_BYTES));
  let freed = 0, deleted = 0, skipped = 0;
  for (const f of all) {
    if (freed >= targetBytes) break;
    if (isProtected(f.path)) { skipped++; continue; }
    if (await tryUnlink(f.path)) { deleted++; freed += f.size; }
    else skipped++;
  }

  for (const root of junkRoots()) await removeEmptyDirs(root);

  log(`✅ Cleanup complete: deleted ${deleted} file(s), freed ${fmtBytes(freed)}, skipped ${skipped}`);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

let _running = false;
async function runCheck() {
  if (_running) return;
  _running = true;
  try {
    await lightSweep();
    const stats = await getStorageStats();
    log(`Disk usage: ${stats.usedHuman} / ${stats.thresholdHuman} (${stats.pct})`);
    if (stats.usedBytes >= THRESHOLD_BYTES) {
      await aggressiveCleanup(stats);
    }
  } catch (e) {
    console.error('🧹 [Storage] check error:', e.message);
  } finally {
    _running = false;
  }
}

// ────────────────── PUBLIC API ──────────────────
let _interval = null;
function startCleanup() {
  log('Intelligent storage manager online');
  log(`Threshold: ${fmtBytes(THRESHOLD_BYTES)} • Interval: ${CHECK_INTERVAL_MS / 60000} min`);
  // initial run, non-blocking
  setTimeout(() => runCheck(), 5000);
  _interval = setInterval(() => runCheck(), CHECK_INTERVAL_MS);
}

function stopCleanup() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

/**
 * Call after successfully sending media to free its temp file immediately.
 * Accepts a single path or an array. Silently skips protected/missing files.
 */
async function cleanupAfterSend(paths) {
  const list = Array.isArray(paths) ? paths : [paths];
  for (const p of list) {
    if (!p || typeof p !== 'string') continue;
    if (isProtected(p)) continue;
    await tryUnlink(p);
  }
}

// Back-compat shim for old callers
async function cleanupOldFiles() { return lightSweep(); }

process.on('SIGINT',  () => { stopCleanup(); });
process.on('SIGTERM', () => { stopCleanup(); });

module.exports = {
  startCleanup,
  stopCleanup,
  cleanupAfterSend,
  cleanupOldFiles,
  getStorageStats,
  isProtected,
};
