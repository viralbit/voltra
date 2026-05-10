/**
 * Per-Account Settings Store
 *
 * Each linked WhatsApp number gets its own settings record. This replaces
 * the old global `config.selfMode`, `config.autoViewStatus`, etc. so that
 * `.mode private` on one linked account does NOT affect any other linked
 * account.
 *
 * Settings are stored in database/accounts.json keyed by the bot's own
 * phone number (extracted from `sock.user.id`). All helpers fall back to
 * the global `config` value when no per-account override exists.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

const DB_DIR = path.join(__dirname, '..', 'database');
const ACCOUNTS_DB = path.join(DB_DIR, 'accounts.json');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(ACCOUNTS_DB)) fs.writeFileSync(ACCOUNTS_DB, '{}');

// Defaults — every key the bot looks up MUST appear here so reads never
// return `undefined`.
const DEFAULTS = {
  selfMode:               false,  // .mode private/public
  autoViewStatus:         false,  // .autoviewsts
  autoLikeStatus:         false,  // .autolikests
  autoReact:              false,  // .autoreact on/off
  autoReactMode:          'bot',  // .autoreact set bot|all
  autoRead:               false,  // .autoread
  autoTyping:             false,  // .autotyping
  autoBio:                false,  // .autobio
  anticall:               false,  // .anticall
  antideleteNotifyOwner:  true,   // .antidelete
};

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(ACCOUNTS_DB, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    fs.writeFileSync(ACCOUNTS_DB, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('[accountSettings] write failed:', e.message);
    return false;
  }
}

/** Extract the bot's clean phone number from a Baileys sock. */
function botNumber(sock) {
  try {
    const raw = sock?.user?.id || '';
    return String(raw).split(':')[0].split('@')[0].replace(/[^0-9]/g, '') || null;
  } catch {
    return null;
  }
}

/** Bot's full WhatsApp JID, useful for sending DMs to "self". */
function botJid(sock) {
  const num = botNumber(sock);
  return num ? `${num}@s.whatsapp.net` : null;
}

/** Get one settings field for this account (with config + DEFAULTS fallback). */
function get(sock, key) {
  const num = botNumber(sock);
  const all = readAll();
  if (num && all[num] && Object.prototype.hasOwnProperty.call(all[num], key)) {
    return all[num][key];
  }
  // Fall back to global config (legacy behavior) then to DEFAULTS
  if (Object.prototype.hasOwnProperty.call(config, key)) return config[key];
  return DEFAULTS[key];
}

/** Get the full settings object for this account. */
function getAll(sock) {
  const num = botNumber(sock);
  const all = readAll();
  const merged = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) {
    if (Object.prototype.hasOwnProperty.call(config, k)) merged[k] = config[k];
  }
  if (num && all[num]) Object.assign(merged, all[num]);
  return merged;
}

/** Set one settings field for this account. */
function set(sock, key, value) {
  const num = botNumber(sock);
  if (!num) return false;
  const all = readAll();
  if (!all[num]) all[num] = {};
  all[num][key] = value;
  return writeAll(all);
}

/**
 * Owner check that respects:
 *   1. The linked WhatsApp number itself (it is always owner of its
 *      OWN session — that is the whole point of per-account settings).
 *   2. The global `config.ownerNumber` list (kept per user request:
 *      "Own number + config owners").
 */
function isOwnerForSock(sock, senderJid) {
  if (!senderJid) return false;
  const senderNum = String(senderJid).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
  if (!senderNum) return false;

  // 1) The linked account is always owner of itself.
  const me = botNumber(sock);
  if (me && me === senderNum) return true;

  // 2) Global owners (legacy behavior).
  const owners = Array.isArray(config.ownerNumber) ? config.ownerNumber : [config.ownerNumber];
  for (const o of owners) {
    if (!o) continue;
    const onum = String(o).replace(/[^0-9]/g, '');
    if (onum && onum === senderNum) return true;
  }
  return false;
}

module.exports = {
  DEFAULTS,
  botNumber,
  botJid,
  get,
  getAll,
  set,
  isOwnerForSock,
};
