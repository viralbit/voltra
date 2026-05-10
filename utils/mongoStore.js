/**
 * MongoDB session persistence for VOLTRA MD.
 *
 * Strategy:
 *  - Each Baileys session is stored in `./sessions/<number>/` as managed by
 *    `useMultiFileAuthState` (creds.json, app-state-*.json, lid-mapping-*.json,
 *    pre-key-*.json, sender-key-*.json, session-*.json, sync-*.json …).
 *  - We mirror the *entire* folder to MongoDB so EVERYTHING survives
 *    Render redeploys / restarts — not just creds.
 *  - On boot we download every saved session back to disk BEFORE Baileys
 *    is started, so `useMultiFileAuthState` finds the files exactly where
 *    it expects them.
 *  - After boot, every `creds.update` triggers a debounced upload of the
 *    folder back to Mongo. A periodic 60s sweep also runs as a safety net
 *    so non-creds files (lid-mapping, sender keys, etc.) are not lost.
 *
 * Collection schema (db: voltra, collection: sessions):
 *   {
 *     _id: "<number>",                 // sanitized phone number
 *     updatedAt: <Date>,
 *     files: { "<filename>": "<base64>" , ... }
 *   }
 *
 * No external Mongo wrapper for Baileys is used — this keeps the whole
 * existing useMultiFileAuthState flow (including lid-mapping reads in
 * handler.js) intact.
 */

const fs = require('fs');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI
  || 'mongodb+srv://voltrazw_db_user:ADmvAv3FPwO7gLOW@cluster0.5taeqz6.mongodb.net/?appName=Cluster0';
const DB_NAME = process.env.MONGO_DB || 'voltra';
const COLL_NAME = process.env.MONGO_COLLECTION || 'sessions';

// Hard limit per session document (Mongo doc max is 16MB; leave headroom).
const MAX_SESSION_BYTES = 14 * 1024 * 1024;

let _client = null;
let _coll = null;
let _connecting = null;

async function getCollection() {
  if (_coll) return _coll;
  if (_connecting) return _connecting;
  _connecting = (async () => {
    _client = new MongoClient(MONGO_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: false,
        deprecationErrors: true
      },
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 15000
    });
    await _client.connect();
    await _client.db('admin').command({ ping: 1 });
    console.log('🗄️  MongoDB connected (session store)');
    _coll = _client.db(DB_NAME).collection(COLL_NAME);
    try { await _coll.createIndex({ updatedAt: 1 }); } catch {}
    return _coll;
  })();
  try {
    return await _connecting;
  } finally {
    _connecting = null;
  }
}

function readFolderToMap(folder) {
  const files = {};
  let totalBytes = 0;
  if (!fs.existsSync(folder)) return { files, totalBytes };
  const entries = fs.readdirSync(folder);
  for (const name of entries) {
    const full = path.join(folder, name);
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (!stat.isFile()) continue;
    try {
      const buf = fs.readFileSync(full);
      files[name] = buf.toString('base64');
      totalBytes += buf.length;
    } catch {}
  }
  return { files, totalBytes };
}

function writeMapToFolder(folder, files) {
  if (!files || typeof files !== 'object') return 0;
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  let n = 0;
  for (const [name, b64] of Object.entries(files)) {
    if (!name || typeof b64 !== 'string') continue;
    // Disallow path traversal — keep files flat.
    if (name.includes('/') || name.includes('\\') || name.includes('..')) continue;
    try {
      fs.writeFileSync(path.join(folder, name), Buffer.from(b64, 'base64'));
      n++;
    } catch (e) {
      console.warn(`[mongoStore] write ${name} failed: ${e.message}`);
    }
  }
  return n;
}

/**
 * Restore one session's files from Mongo into `folder`.
 * Returns true if at least one file (specifically creds.json) was restored.
 */
async function restoreSession(number, folder) {
  try {
    const coll = await getCollection();
    const doc = await coll.findOne({ _id: String(number) });
    if (!doc || !doc.files) return false;
    const written = writeMapToFolder(folder, doc.files);
    const hasCreds = !!doc.files['creds.json'];
    if (written) {
      console.log(`♻️  [mongo] Restored ${written} file(s) for ${number}${hasCreds ? '' : ' (no creds.json!)'}`);
    }
    return hasCreds;
  } catch (e) {
    console.error(`[mongoStore] restore ${number} failed:`, e.message);
    return false;
  }
}

/**
 * Restore every saved session from Mongo onto disk under `sessionsRoot`.
 * Returns an array of restored numbers.
 */
async function restoreAllSessionsFromMongo(sessionsRoot) {
  try {
    const coll = await getCollection();
    const cursor = coll.find({}, { projection: { _id: 1, files: 1 } });
    const restored = [];
    for await (const doc of cursor) {
      const number = String(doc._id || '').replace(/[^0-9]/g, '');
      if (!number) continue;
      const folder = path.join(sessionsRoot, number);
      const written = writeMapToFolder(folder, doc.files || {});
      if (doc.files && doc.files['creds.json']) {
        restored.push(number);
        console.log(`♻️  [mongo] Pre-restored ${written} file(s) for ${number}`);
      }
    }
    return restored;
  } catch (e) {
    console.error('[mongoStore] restoreAll failed:', e.message);
    return [];
  }
}

/**
 * Upload the current contents of `folder` to Mongo, replacing the document.
 */
async function saveSession(number, folder) {
  try {
    const coll = await getCollection();
    const { files, totalBytes } = readFolderToMap(folder);
    if (!Object.keys(files).length) return false;
    if (totalBytes > MAX_SESSION_BYTES) {
      console.warn(`[mongoStore] ${number} session ${totalBytes}B exceeds cap; trimming non-essential files`);
      // Drop the largest non-essential entries until under the cap.
      const essential = new Set(['creds.json']);
      const sorted = Object.entries(files)
        .filter(([k]) => !essential.has(k))
        .sort((a, b) => b[1].length - a[1].length);
      let bytes = totalBytes;
      while (bytes > MAX_SESSION_BYTES && sorted.length) {
        const [k, v] = sorted.shift();
        delete files[k];
        bytes -= v.length;
      }
    }
    await coll.updateOne(
      { _id: String(number) },
      { $set: { files, updatedAt: new Date() } },
      { upsert: true }
    );
    return true;
  } catch (e) {
    console.error(`[mongoStore] save ${number} failed:`, e.message);
    return false;
  }
}

/**
 * Debounced/serialized save manager. One saver per number, coalesces bursts
 * (Baileys fires creds.update many times during handshake), and chains
 * a follow-up save if requests arrive while one is already in flight.
 */
const _pending = new Map();    // number -> timer
const _inflight = new Map();   // number -> Promise
const _redo = new Set();       // number -> needs another save after current

function scheduleSave(number, folder, delayMs = 1500) {
  const key = String(number);
  if (_inflight.has(key)) {
    _redo.add(key);
    return;
  }
  if (_pending.has(key)) {
    clearTimeout(_pending.get(key));
  }
  const t = setTimeout(async () => {
    _pending.delete(key);
    const p = saveSession(key, folder).catch(() => false);
    _inflight.set(key, p);
    try { await p; } finally {
      _inflight.delete(key);
      if (_redo.has(key)) {
        _redo.delete(key);
        scheduleSave(key, folder, 500);
      }
    }
  }, delayMs);
  _pending.set(key, t);
}

/**
 * Periodic safety-net sweep: re-saves every active session folder.
 * Catches files Baileys writes outside `creds.update` (sender keys,
 * lid-mapping updates, etc.).
 */
function startPeriodicSync(sessionsRoot, intervalMs = 60_000) {
  setInterval(() => {
    try {
      if (!fs.existsSync(sessionsRoot)) return;
      for (const e of fs.readdirSync(sessionsRoot, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        const num = String(e.name).replace(/[^0-9]/g, '');
        if (!num) continue;
        const folder = path.join(sessionsRoot, e.name);
        const credsFile = path.join(folder, 'creds.json');
        if (!fs.existsSync(credsFile)) continue;
        scheduleSave(num, folder, 200);
      }
    } catch (err) {
      console.warn('[mongoStore] periodic sync error:', err.message);
    }
  }, intervalMs).unref?.();
}

async function deleteSession(number) {
  try {
    const coll = await getCollection();
    await coll.deleteOne({ _id: String(number) });
    console.log(`🗑️  [mongo] Deleted session ${number}`);
  } catch (e) {
    console.error(`[mongoStore] delete ${number} failed:`, e.message);
  }
}

async function close() {
  try { await _client?.close(); } catch {}
  _client = null; _coll = null;
}

module.exports = {
  getCollection,
  restoreSession,
  restoreAllSessionsFromMongo,
  saveSession,
  scheduleSave,
  startPeriodicSync,
  deleteSession,
  close
};
