/**
 * VOLTRA MD — Multi-Session Entry
 * Brand: Voltra  •  Developer: Calyx Drey
 *
 * - Express frontend + pairing code only
 * - UNLIMITED multi-session pairing (each number = its own Baileys socket)
 * - Auto-restore all saved sessions on boot (no welcome message on restore)
 * - Welcome message ONLY on a fresh device link
 * - Auto-follow Voltra Tech newsletter channels (per session)
 * - Optional auto-view + auto-like for incoming WhatsApp statuses
 * - Self keep-alive ping every 2 minutes (avoids Render idle restarts)
 */

process.env.PUPPETEER_SKIP_DOWNLOAD = 'true';
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';

const { initializeTempSystem } = require('./utils/tempManager');
const { startCleanup } = require('./utils/cleanup');
try { initializeTempSystem(); } catch (e) { console.warn('tempSystem init failed:', e.message); }
try { startCleanup(); } catch (e) { console.warn('cleanup init failed:', e.message); }

// ---------- Console noise filter ----------
const _log = console.log, _err = console.error, _warn = console.warn;
const NOISE = ['closing session','closing open session','sessionentry','prekey bundle','pendingprekey','_chains','registrationid','currentratchet','chainkey','ratchet','signal protocol','ephemeralkeypair','indexinfo','basekey'];
const filter = (orig) => (...args) => {
  const m = args.map(a => typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()).join(' ').toLowerCase();
  if (!NOISE.some(p => m.includes(p))) orig.apply(console, args);
};
console.log = filter(_log); console.error = filter(_err); console.warn = filter(_warn);

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');
const pino = require('pino');
const fetch = require('node-fetch');
const QRCode = require('qrcode');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore,
  jidDecode
} = require('@whiskeysockets/baileys');

const config = require('./config');
const handler = require('./handler');
const mongoStore = require('./utils/mongoStore');
const accountSettings = require('./utils/accountSettings');

const silentLogger = pino({ level: 'silent' });

const SESSIONS_ROOT = path.resolve('./sessions');
if (!fs.existsSync(SESSIONS_ROOT)) fs.mkdirSync(SESSIONS_ROOT, { recursive: true });

const sessions = new Map();

function sanitizeNumber(n) {
  return String(n || '').replace(/[^0-9]/g, '');
}

// Decode any sock.user.id into a clean PN JID we can sendMessage to.
function meJid(sock, fallbackNumber) {
  try {
    const raw = sock?.user?.id || '';
    const dec = jidDecode(raw);
    if (dec?.user) return `${dec.user}@s.whatsapp.net`;
    const digits = String(raw).split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
    if (digits) return `${digits}@s.whatsapp.net`;
  } catch {}
  return `${sanitizeNumber(fallbackNumber)}@s.whatsapp.net`;
}

// ============================================================
// Dynamic CHANNELS source — fetched from remote JSON
// ============================================================
const { ALLOWED_EMOJIS: __RA_EMOJIS, randomEmoji: __raEmoji, randomReactDelay: __raDelay, delay: __raSleep } = require('./utils/reactions');
const _newsletterReactConfigs = new Map();
const _reactedMessageIds = new Set();
// Per-session dedupe of status posts we've already viewed/liked.
const _statusSeen = new Set();

const CHANNELS_URL = 'https://channel-newsletters.netlify.app/channels.json';
let CHANNELS = [];

async function refreshChannels() {
  try {
    const res = await fetch(CHANNELS_URL, { timeout: 10000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !Array.isArray(data.channels)) throw new Error('Invalid payload (channels not array)');
    const next = data.channels.filter(j => typeof j === 'string' && j.endsWith('@newsletter'));
    if (!next.length) {
      console.warn('⚠️ [channels] remote returned 0 channels — keeping previous list');
      return;
    }
    const prevSet = new Set(CHANNELS);
    const added = next.filter(j => !prevSet.has(j));
    CHANNELS = next;
    if (added.length) {
      console.log(`📡 [channels] Loaded ${CHANNELS.length} channel(s) (${added.length} new)`);
    }
    syncReactConfigsWithChannels();
    for (const s of sessions.values()) {
      if (s && s.status === 'connected' && s.sock) {
        autoFollowChannels(s.sock, s).catch(() => {});
      }
    }
  } catch (e) {
    console.warn(`⚠️ [channels] refresh failed: ${e.message} — keeping ${CHANNELS.length} cached`);
  }
}

function syncReactConfigsWithChannels() {
  const emojis = (Array.isArray(config.channelReactEmojis) && config.channelReactEmojis.length)
    ? config.channelReactEmojis : __RA_EMOJIS;
  for (const jid of CHANNELS) {
    if (!_newsletterReactConfigs.has(jid)) _newsletterReactConfigs.set(jid, emojis);
  }
  for (const jid of Array.from(_newsletterReactConfigs.keys())) {
    if (!CHANNELS.includes(jid)) _newsletterReactConfigs.delete(jid);
  }
}

refreshChannels();
setInterval(refreshChannels, 15 * 1000);


function publicView(s) {
  return {
    number: s.number,
    status: s.status,
    user: s.user,
    pairingCode: s.pairingCode,
    qr: s.qr || null,
    pairMode: s.pairMode || 'code',
    lastError: s.lastError,
    connectedAt: s.connectedAt,
    uptime: s.connectedAt ? Math.floor((Date.now() - s.connectedAt) / 1000) : 0,
    followed: Array.from(s.followed || [])
  };
}

const isSystemJid = (jid) => !jid || jid.includes('@broadcast') || jid.includes('status.broadcast') || jid.includes('@newsletter');

// ---------- Channel auto-follow ----------
async function autoFollowChannels(sock, s) {
  const jids = Array.from(new Set(CHANNELS))
    .filter(j => typeof j === 'string' && j.endsWith('@newsletter'));
  if (!jids.length) return;

  for (const jid of jids) {
    if (s.followed.has(jid)) {
      try { await sock.subscribeNewsletterUpdates?.(jid); } catch {}
      continue;
    }
    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      try {
        if (typeof sock.newsletterFollow === 'function') {
          await sock.newsletterFollow(jid);
        }
        try { await sock.subscribeNewsletterUpdates?.(jid); } catch {}
        s.followed.add(jid);
        console.log(`📡 [${s.number}] Followed + subscribed ${jid}`);
        break;
      } catch (e) {
        if (attempts >= 3) console.warn(`⚠️ [${s.number}] follow failed ${jid}: ${e.message}`);
        else await new Promise(r => setTimeout(r, 1500 * attempts));
      }
    }
  }
}

// ---------- Channel auto-reaction (newsletter) ----------
function addNewsletterReactConfig(jid) {
  if (!jid || !jid.endsWith('@newsletter')) throw new Error('Invalid newsletter JID');
  _newsletterReactConfigs.set(jid, __RA_EMOJIS);
  console.log(`📌 [autolike] Added config for ${jid}`);
}
function removeNewsletterReactConfig(jid) {
  if (!_newsletterReactConfigs.has(jid)) throw new Error('Channel not in auto-like list');
  _newsletterReactConfigs.delete(jid);
  console.log(`🗑️ [autolike] Removed config for ${jid}`);
}
function pickEmoji() { return __raEmoji(); }

function extractServerId(msg) {
  if (!msg || !msg.key) return null;
  const rawServerId =
    msg.newsletterServerId ??
    msg.messageServerID ??
    msg.server_id ??
    msg.key?.server_id ??
    msg.key?.id;
  if (rawServerId === undefined || rawServerId === null) return null;
  const serverIdStr = String(rawServerId);
  if (!/^\d+$/.test(serverIdStr)) return null;
  return serverIdStr;
}

async function reactToChannelPost(_originSock, msg, _originSession) {
  try {
    const jid = msg?.key?.remoteJid || '';
    if (!jid || !CHANNELS.includes(jid) || !_newsletterReactConfigs.has(jid)) return;

    const serverIdStr = extractServerId(msg);
    if (!serverIdStr) return;

    const liveSessions = [];
    for (const s of sessions.values()) {
      if (s && s.status === 'connected' && s.sock && typeof s.sock.newsletterReactMessage === 'function') {
        liveSessions.push(s);
      }
    }
    if (!liveSessions.length) return;

    if (_reactedMessageIds.size > 5000) _reactedMessageIds.clear();

    const SEQUENTIAL_REACT_GAP_MS = 5000;
    for (let i = 0; i < liveSessions.length; i++) {
      const s = liveSessions[i];
      const dedupeKey = `${jid}|${serverIdStr}|${s.number}`;
      if (_reactedMessageIds.has(dedupeKey)) continue;
      _reactedMessageIds.add(dedupeKey);
      if (i > 0) await __raSleep(SEQUENTIAL_REACT_GAP_MS);
      const emoji = pickEmoji();
      try {
        await s.sock.newsletterReactMessage(jid, serverIdStr, emoji);
        console.log(`✅ [autolike] [${s.number}] Reacted ${emoji} → ${jid}`);
      } catch (reactErr) {
        console.error(`❌ [autolike] [${s.number}] Reaction failed:`, reactErr?.message || reactErr);
        _reactedMessageIds.delete(dedupeKey);
      }
    }
  } catch (err) {
    console.error('❌ [autolike] Error:', err?.message || err);
  }
}

async function handleAutolikeCommand(sock, msg) {
  if (!msg.message || !msg.key || !msg.key.remoteJid) return false;
  const from = msg.key.remoteJid;
  const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
  if (!body.startsWith(config.prefix)) return false;
  const [command, ...args] = body.slice(config.prefix.length).trim().split(/\s+/);
  const cmd = command.toLowerCase();

  if (cmd === 'autolike') {
    const jid = args[0];
    if (!jid || !jid.endsWith('@newsletter')) {
      await sock.sendMessage(from, { text: '⚠️ Provide a valid channel JID (e.g. 1203xxxx@newsletter)' });
      return true;
    }
    try { addNewsletterReactConfig(jid); await sock.sendMessage(from, { text: `✅ Auto-like enabled for ${jid}` }); }
    catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }); }
    return true;
  }
  if (cmd === 'stoplike') {
    const jid = args[0];
    if (!jid || !jid.endsWith('@newsletter')) {
      await sock.sendMessage(from, { text: '⚠️ Provide a valid channel JID' });
      return true;
    }
    try { removeNewsletterReactConfig(jid); await sock.sendMessage(from, { text: `🛑 Auto-like disabled for ${jid}` }); }
    catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }); }
    return true;
  }
  return false;
}

// ---------- Status auto-view + auto-like ----------
async function handleStatusUpdate(sock, s, msg) {
  try {
    const from = msg?.key?.remoteJid || '';
    if (from !== 'status@broadcast') return;
    if (msg.key.fromMe) return;

    // Read per-account toggles (each linked WhatsApp has its own settings).
    const acct = accountSettings.getAll(sock);

    const dedupeKey = `${s.number}|${msg.key.id}|${msg.key.participant || ''}`;
    if (_statusSeen.has(dedupeKey)) return;
    _statusSeen.add(dedupeKey);
    if (_statusSeen.size > 10000) _statusSeen.clear();

    const participant = msg.key.participant;

    // Auto-view
    if (acct.autoViewStatus) {
      try {
        await sock.readMessages([msg.key]);
        console.log(`👁️ [${s.number}] Viewed status from ${participant}`);
      } catch (e) {
        console.warn(`[${s.number}] view status failed: ${e.message}`);
      }
    }

    // Auto-like (react ❤️)
    if (acct.autoLikeStatus && participant) {
      try {
        await sock.sendMessage(
          'status@broadcast',
          { react: { text: '❤️', key: msg.key } },
          { statusJidList: [participant] }
        );
        console.log(`❤️ [${s.number}] Liked status from ${participant}`);
      } catch (e) {
        console.warn(`[${s.number}] like status failed: ${e.message}`);
      }
    }
  } catch (e) {
    console.error('[status] handler error:', e.message);
  }
}

// ---------- Per-session boot ----------
async function startSession(number, opts = {}) {
  number = sanitizeNumber(number);
  if (!number) throw new Error('Invalid number');

  let s = sessions.get(number);
  if (!s) {
    s = {
      number,
      status: 'idle',
      user: null,
      pairingCode: null,
      qr: null,
      pairMode: opts.mode === 'qr' ? 'qr' : 'code',
      lastError: null,
      connectedAt: null,
      startedAt: Date.now(),
      sock: null,
      starting: false,
      followed: new Set(),
      processed: new Set(),
      pendingPair: !!opts.requestPair,
      // Tracking for welcome-message logic + reconnect backoff:
      isRestored: false,        // true ⇢ creds existed before this boot
      welcomeSent: false,       // flip true once welcome delivered
      reconnectAttempts: 0
    };
    sessions.set(number, s);
  } else if (opts.requestPair) {
    s.pendingPair = true;
    s.pairMode = opts.mode === 'qr' ? 'qr' : 'code';
    s.qr = null;
    s.pairingCode = null;
  }

  if (s.starting) return s;
  s.starting = true;
  s.status = 'connecting';
  s.lastError = null;

  const sessionFolder = path.join(SESSIONS_ROOT, number);
  if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });

  // Pull this session's files down from MongoDB before Baileys reads them.
  try { await mongoStore.restoreSession(number, sessionFolder); } catch {}

  // Detect "restored" vs "fresh pair":
  // — if creds.json already exists (locally OR pulled from Mongo) we treat
  //   this as a restored session and SUPPRESS the welcome message on the
  //   next connection.open. Only a brand-new device link sends the welcome.
  const credsFile = path.join(sessionFolder, 'creds.json');
  if (!opts.requestPair) {
    // Boot-time restore path
    s.isRestored = fs.existsSync(credsFile);
  } else {
    // Explicit pair request always counts as "fresh"
    s.isRestored = false;
    s.welcomeSent = false;
  }

  const { state: authState, saveCreds } = await useMultiFileAuthState(sessionFolder);

  let version;
  try { ({ version } = await fetchLatestBaileysVersion()); }
  catch { version = [2, 3000, 1015901307]; }

  const sock = makeWASocket({
    version,
    logger: silentLogger,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    auth: {
      creds: authState.creds,
      keys: makeCacheableSignalKeyStore(authState.keys, silentLogger)
    },
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    // Returning an empty stub keeps Baileys happy on re-decrypt requests
    // and prevents the periodic "no message available" disconnect loop
    // that was causing random reconnects on restored sessions.
    getMessage: async () => ({ conversation: '' }),
    // Aggressive keep-alive so idle sockets don't get reaped by WhatsApp
    keepAliveIntervalMs: 25_000,
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    emitOwnEvents: false
  });
  s.sock = sock;

  if (!s._gc) {
    s._gc = setInterval(() => s.processed.clear(), 5 * 60 * 1000);
  }

  // Pairing code request (only for fresh pair requests)
  if (s.pendingPair && s.pairMode !== 'qr' && !sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const customRaw = (config.customPairingCode || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const customCode = (customRaw.length === 8) ? customRaw : null;
        const code = customCode
          ? await sock.requestPairingCode(number, customCode)
          : await sock.requestPairingCode(number);
        s.pairingCode = code;
        s.status = 'pairing';
        console.log(`🔗 [${number}] Pairing code: ${code}`);
      } catch (e) {
        s.lastError = `Pairing failed: ${e.message}`;
        console.error(`[${number}] Pairing error:`, e.message);
      } finally {
        s.pendingPair = false;
      }
    }, 400);
  }

  sock.ev.on('creds.update', async () => {
    try { await saveCreds(); } catch (e) { console.warn(`[${number}] saveCreds:`, e.message); }
    mongoStore.scheduleSave(number, sessionFolder);
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (connection === 'connecting') console.log(`⏳ [${number}] Connecting...`);

    if (qr && s.pairMode === 'qr') {
      try {
        s.qr = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
        s.status = 'pairing';
        console.log(`📷 [${number}] QR code generated`);
      } catch (e) {
        console.warn(`[${number}] qr encode failed: ${e.message}`);
      }
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
        || lastDisconnect?.error?.output?.payload?.statusCode;
      const reason = lastDisconnect?.error?.message || 'unknown';
      const restartRequired = code === DisconnectReason.restartRequired || code === 515;
      const loggedOut = code === DisconnectReason.loggedOut || code === 401;

      console.log(`🔌 [${number}] closed code=${code} reason="${reason}" restart=${restartRequired} loggedOut=${loggedOut}`);

      s.pairingCode = null;
      s.qr = null;
      s.starting = false;
      s.connectedAt = null;

      if (loggedOut) {
        console.log(`🚪 [${number}] Logged out. Removing session.`);
        try { fs.rmSync(sessionFolder, { recursive: true, force: true }); } catch {}
        mongoStore.deleteSession(number).catch(() => {});
        if (s._gc) { clearInterval(s._gc); s._gc = null; }
        sessions.delete(number);
        return;
      }

      // Reconnect with capped exponential backoff. Restored sessions
      // should reconnect silently — never trigger a welcome message
      // because s.welcomeSent stays whatever it was.
      s.status = 'connecting';
      s.reconnectAttempts = (s.reconnectAttempts || 0) + 1;
      const base = restartRequired ? 1000 : 2000;
      const delay = Math.min(base * Math.pow(1.6, Math.min(s.reconnectAttempts, 6)), 30_000);
      console.log(`🔁 [${number}] Reconnecting in ${Math.round(delay)}ms (attempt ${s.reconnectAttempts})`);
      setTimeout(() => startSession(number).catch(err =>
        console.error(`reconnect ${number}:`, err.message)
      ), delay);
      return;
    }

    if (connection === 'open') {
      s.status = 'connected';
      s.pairingCode = null;
      s.qr = null;
      s.user = sock.user?.id?.split(':')[0]?.split('@')[0] || number;
      s.connectedAt = Date.now();
      s.reconnectAttempts = 0;
      console.log(`✅ [${number}] Connected as ${s.user}`);

      try { handler.initializeAntiCall?.(sock); } catch {}
      autoFollowChannels(sock, s).catch(() => {});
      setTimeout(() => autoFollowChannels(sock, s).catch(() => {}), 15000);

      // ---------- Welcome message ----------
      // Send ONCE per fresh device link. Skip entirely on restored sessions
      // and on every reconnect after the first successful pair.
      if (!s.isRestored && !s.welcomeSent) {
        // Wait for the socket to fully settle before sending — this is
        // why the previous version's welcome was failing silently right
        // after pair-success.
        setTimeout(async () => {
          try {
            const target = meJid(sock, number);
            const successText =
`✅ *${config.botName}* — Connection Successful!

📱 Number  : ${s.user}
👑 Owner   : ${Array.isArray(config.ownerName) ? config.ownerName[0] : config.developer}
🚀 Brand   : ${config.brand}
📡 Channel : ${config.newsletterName || 'Voltra Tech'}
⚡ Prefix  : ${config.prefix}

🟢 Your WhatsApp is now linked to ${config.botName}.

▸ Send *${config.prefix}menu*  to view all commands
▸ Send *${config.prefix}alive* to check status
▸ Send *${config.prefix}ping*  to test response

> Powered by ${config.brand} • ${config.developer}`;

            await sock.sendMessage(target, {
              text: successText,
              contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                  newsletterJid: config.newsletterJid,
                  newsletterName: config.newsletterName || 'Voltra Tech',
                  serverMessageId: -1
                }
              }
            });
            s.welcomeSent = true;
            // From here on, every future open() is a reconnect → no welcome.
            s.isRestored = true;
            console.log(`💌 [${number}] Welcome message delivered to ${target}`);
          } catch (e) {
            console.warn(`[${number}] welcome msg failed:`, e.message);
            // Retry once after 5s — most failures are "socket not ready yet"
            setTimeout(async () => {
              if (s.welcomeSent) return;
              try {
                const target = meJid(sock, number);
                await sock.sendMessage(target, { text: `✅ ${config.botName} connected as ${s.user}.` });
                s.welcomeSent = true;
                s.isRestored = true;
                console.log(`💌 [${number}] Welcome retry delivered`);
              } catch (err2) {
                console.warn(`[${number}] welcome retry failed:`, err2.message);
              }
            }, 5000);
          }
        }, 1500);
      } else {
        console.log(`♻️  [${number}] Restored session — welcome message suppressed`);
      }
    }
  });

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    for (const msg of messages) {
      if (!msg?.key?.id) continue;
      const from = msg.key.remoteJid;
      if (!from) continue;

      // Status updates → auto-view / auto-like
      if (from === 'status@broadcast') {
        handleStatusUpdate(sock, s, msg).catch(e =>
          console.error('[status] upsert error:', e?.message || e)
        );
        continue;
      }

      // Newsletter / channel posts — fire auto-like reaction
      if (from.endsWith('@newsletter')) {
        reactToChannelPost(sock, msg, s).catch(e =>
          console.error('[autolike] upsert error:', e?.message || e)
        );
      }

      if (!msg.message) continue;
      try { handler.cacheMessage(msg); } catch {}
      if (type !== 'notify') continue;

      handleAutolikeCommand(sock, msg).catch(() => {});

      if (isSystemJid(from)) continue;

      const id = msg.key.id;
      if (s.processed.has(id)) continue;

      const ts = msg.messageTimestamp ? Date.now() - (msg.messageTimestamp * 1000) : 0;
      if (ts > 5 * 60 * 1000) continue;
      s.processed.add(id);

      handler.handleMessage(sock, msg).catch(err => {
        if (!/rate-overlimit|not-authorized/.test(err.message || '')) {
          console.error(`[${number}] handleMessage:`, err.message);
        }
      });

      setImmediate(async () => {
        if (accountSettings.get(sock, 'autoRead') && from.endsWith('@g.us')) {
          try { await sock.readMessages([msg.key]); } catch {}
        }
        if (from.endsWith('@g.us')) {
          let meta = null;
          try { meta = await handler.getGroupMetadata(sock, from); } catch {}
          try { await handler.handleAntilink(sock, msg, meta); }
          catch (e) { console.error(`[${number}] antilink:`, e.message); }
          try { await handler.handleAntiMedia(sock, msg, meta); }
          catch (e) { console.error(`[${number}] antimedia:`, e.message); }
        }
      });
    }
  });

  sock.ev.on('messages.update', (updates) => {
    if (!Array.isArray(updates)) return;
    for (const u of updates) {
      try { handler.handleAntiDelete(sock, u); } catch {}
      const from = u?.key?.remoteJid || '';
      if (!from.endsWith('@newsletter')) continue;
      const msgLike = {
        key: u.key,
        message: u.update?.message || u.message || undefined,
        messageStubType: u.update?.messageStubType,
        messageServerID: u.update?.messageServerID || u.messageServerID,
        newsletterServerId: u.update?.newsletterServerId || u.newsletterServerId
      };
      reactToChannelPost(sock, msgLike, s).catch(e =>
        console.error('[autolike] update error:', e?.message || e)
      );
    }
  });

  sock.ev.on('group-participants.update', async (update) => {
    try { await handler.handleGroupUpdate(sock, update); } catch {}
  });

  sock.ev.on('error', (e) => {
    const code = e?.output?.statusCode;
    if ([515, 503, 408].includes(code)) return;
    console.error(`[${number}] socket error:`, e.message || e);
  });

  s.starting = false;
  return s;
}

// ---------- Restore existing sessions on boot ----------
async function restoreAllSessions() {
  console.log(`🔁 [restore] Boot — scanning ${SESSIONS_ROOT}`);
  try {
    const restored = await mongoStore.restoreAllSessionsFromMongo(SESSIONS_ROOT);
    if (restored.length) {
      console.log(`☁️  [mongo] Pre-restored ${restored.length} session(s) from MongoDB`);
    } else {
      console.log(`☁️  [mongo] No sessions returned from MongoDB`);
    }
  } catch (e) {
    console.warn('mongo pre-restore failed:', e.message);
  }

  let entries = [];
  try { entries = fs.readdirSync(SESSIONS_ROOT, { withFileTypes: true }); } catch {}
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  console.log(`🔁 [restore] Found ${dirs.length} session folder(s): ${dirs.join(', ') || '(none)'}`);

  let started = 0;
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const num = sanitizeNumber(e.name);
    if (!num) continue;
    const credsFile = path.join(SESSIONS_ROOT, e.name, 'creds.json');
    if (!fs.existsSync(credsFile)) {
      console.log(`⚠️  [restore] ${num}: no creds.json — skipping`);
      continue;
    }
    console.log(`♻️  [restore] Restoring session ${num} (welcome suppressed)`);
    started++;
    startSession(num).catch(err => console.error(`restore ${num}:`, err.message));
  }
  console.log(`🔁 [restore] Triggered ${started} session restart(s)`);

  mongoStore.startPeriodicSync(SESSIONS_ROOT, 60_000);
}

// ============================================================
// Express
// ============================================================
const app = express();
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'utils')));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (_req, res) => {
  const list = Array.from(sessions.values()).map(publicView);
  const connected = list.filter(x => x.status === 'connected').length;
  res.json({
    bot: { name: config.botName, brand: config.brand, developer: config.developer },
    totalSessions: list.length,
    connectedSessions: connected,
    sessions: list,
    uptime: Math.floor(process.uptime())
  });
});

app.post('/api/pair', async (req, res) => {
  try {
    const number = sanitizeNumber(req.body?.number);
    const mode = req.body?.mode === 'qr' ? 'qr' : 'code';
    if (number.length < 8) {
      return res.status(400).json({ ok: false, error: 'Invalid number. Include country code, digits only.' });
    }

    const existing = sessions.get(number);
    if (existing && existing.status === 'connected') {
      return res.status(400).json({ ok: false, error: 'This number is already linked.' });
    }

    const s = await startSession(number, { requestPair: true, mode });

    if (s.sock?.authState?.creds?.registered) {
      try { await s.sock.logout(); } catch {}
      try { fs.rmSync(path.join(SESSIONS_ROOT, number), { recursive: true, force: true }); } catch {}
      try { await mongoStore.deleteSession(number); } catch {}
      sessions.delete(number);
      await startSession(number, { requestPair: true, mode });
    }

    const updated = sessions.get(number);
    let tries = 0;
    while (updated && !updated.pairingCode && !updated.qr && tries < 100) {
      await new Promise(r => setTimeout(r, 200));
      tries++;
    }

    if (mode === 'qr' && updated?.qr) {
      return res.json({ ok: true, mode, qr: updated.qr, number });
    }
    if (mode === 'code' && updated?.pairingCode) {
      return res.json({ ok: true, mode, code: updated.pairingCode, number });
    }
    return res.json({ ok: true, queued: true, mode, number, message: mode === 'qr' ? 'Generating QR...' : 'Generating pairing code...' });
  } catch (e) {
    console.error('pair endpoint:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

const BOOT_TIME = Date.now();

app.get('/api/uptime', (_req, res) => {
  const ms = Date.now() - BOOT_TIME;
  res.json({
    ok: true,
    uptimeSeconds: Math.floor(ms / 1000),
    uptimeHuman: (() => {
      const sec = Math.floor(ms / 1000);
      const d = Math.floor(sec / 86400);
      const h = Math.floor((sec % 86400) / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      return `${d}d ${h}h ${m}m ${s}s`;
    })(),
    bootedAt: new Date(BOOT_TIME).toISOString()
  });
});

app.get('/api/sessions', (_req, res) => {
  const list = Array.from(sessions.values()).map(publicView);
  res.json({ ok: true, total: list.length, sessions: list });
});

app.get('/api/active', (_req, res) => {
  const list = Array.from(sessions.values())
    .map(publicView)
    .filter(x => x.status === 'connected');
  res.json({ ok: true, active: list.length, sessions: list });
});

app.get('/api/paircode/:number', (req, res) => {
  const num = sanitizeNumber(req.params.number);
  const s = sessions.get(num);
  if (!s) return res.status(404).json({ ok: false, error: 'No session for this number. POST /api/pair first.' });
  res.json({
    ok: true,
    number: num,
    status: s.status,
    pairMode: s.pairMode || 'code',
    pairingCode: s.pairingCode,
    qr: s.qr || null,
    user: s.user,
    connectedAt: s.connectedAt
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    bot: config.botName,
    brand: config.brand,
    developer: config.developer,
    customPairingCode: (config.customPairingCode || '').toUpperCase(),
    totalSessions: sessions.size,
    activeSessions: Array.from(sessions.values()).filter(x => x.status === 'connected').length,
    uptimeSeconds: Math.floor((Date.now() - BOOT_TIME) / 1000)
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 VOLTRA MD web UI: http://localhost:${PORT}`);
});

// ============================================================
// Self keep-alive
// ============================================================
function selfPing() {
  const url = process.env.SELF_URL
    || process.env.RENDER_EXTERNAL_URL
    || `http://127.0.0.1:${PORT}`;
  const target = url.replace(/\/+$/, '') + '/api/status';
  const lib = target.startsWith('https') ? https : http;
  try {
    const req = lib.get(target, { timeout: 15000 }, (r) => {
      r.on('data', () => {});
      r.on('end', () => console.log(`💓 keep-alive ${r.statusCode} ${target}`));
    });
    req.on('error', (e) => console.warn('keep-alive error:', e.message));
    req.on('timeout', () => req.destroy());
  } catch (e) {
    console.warn('keep-alive throw:', e.message);
  }
}
setInterval(selfPing, 2 * 60 * 1000);
setTimeout(selfPing, 20 * 1000);

console.log('🚀 Booting VOLTRA MD (multi-session)...');
console.log(`📦 ${config.botName}  •  Brand: ${config.brand}  •  Dev: ${config.developer}`);
restoreAllSessions().catch(err => console.error('restore error:', err));
