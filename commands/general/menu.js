/**
 * Menu Command — VOLTRA MD (new boxed style v2)
 *
 * Renders a multi-section menu in the user-supplied format:
 *
 *   ┏▣ /////◈ *VOLTRA SYSTEM* ◈
 *   ┃
 *   ┃  👋 *User:* drey
 *   ┃  ⚡ *Prefix:* [ . ]
 *   ┃  ...
 *   ┗━━━━━━━━━━━━━━━━━━━━━━━▣
 *
 * Sections are auto-built from loaded commands so newly added commands
 * automatically appear in the right group.
 */

const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { loadCommands } = require('../../utils/commandLoader');
const { multiBox, formatViralUI } = require('../../utils/style');
const accountSettings = require('../../utils/accountSettings');
const { normalizeJidWithLid } = require('../../utils/jidHelper');

// Mapping of category-name → { title, emoji per command }.
// Anything not listed falls back to the command's own category.
const SECTION_DEFS = [
  {
    key: 'system', title: 'SYSTEM COMMANDS',
    cmds: ['menu', 'help', 'ping', 'alive', 'owner', 'runtime', 'uptime', 'stats'],
    icons: { menu: '📋', help: '❓', ping: '🏓', alive: '✨', owner: '👤',
             runtime: '⏳', uptime: '⏳', stats: '📊' }
  },
  {
    key: 'group', title: 'GROUP CONTROL',
    cmds: ['tagall', 'hidetag', 'kick', 'add', 'promote', 'demote',
           'antilink', 'welcome', 'goodbye', 'mute', 'unmute',
           'antiaudio', 'antifile', 'antivideo', 'antisticker', 'antivv'],
    icons: { tagall: '📣', hidetag: '👻', kick: '🚪', add: '➕',
             promote: '🆙', demote: '⬇️', antilink: '🚫', welcome: '👋',
             goodbye: '🎈', mute: '🔇', unmute: '🔊', antiaudio: '🎙',
             antifile: '📁', antivideo: '🎬', antisticker: '🩹', antivv: '👁' }
  },
  {
    key: 'auto', title: 'AUTO FEATURES',
    cmds: ['autoreact', 'autoviewsts', 'autostatusview', 'autotyping',
           'autosticker', 'autoread', 'online'],
    icons: { autoreact: '❤️', autoviewsts: '👁️', autostatusview: '👁️',
             autotyping: '⌨️', autosticker: '🎭', autoread: '📖', online: '🟢' }
  },
  {
    key: 'channel', title: 'CHANNEL TOOLS',
    cmds: ['jid', 'channelinfo', 'autolike', 'stoplike'],
    icons: { jid: '🆔', channelinfo: 'ℹ️', autolike: '💖', stoplike: '🚫' }
  },
  {
    key: 'download', title: 'DOWNLOADERS',
    cmds: ['play', 'song', 'ytmp3', 'ytmp4', 'video', 'tiktok',
           'instagram', 'facebook', 'spotify', 'pinterest', 'igs', 'igsc'],
    icons: { play: '🎶', song: '🎶', ytmp3: '🎵', ytmp4: '🎥',
             video: '🎥', tiktok: '📱', instagram: '📸', facebook: '📘',
             spotify: '🎧', pinterest: '📌', igs: '📷', igsc: '📷' }
  },
  {
    key: 'utility', title: 'UTILITIES',
    cmds: ['sticker', 'toimg', 'tomp3', 'tts', 'meme', 'quote',
           'calc', 'shortlink', 'translate', 'github', 'crop', 'take'],
    icons: { sticker: '🖼️', toimg: '♻️', tomp3: '🎤', tts: '🗣️',
             meme: '🤡', quote: '✍️', calc: '🔢', shortlink: '🔗',
             translate: '🌐', github: '🐙', crop: '✂️', take: '🎟️' }
  },
  {
    key: 'dev', title: 'DEVELOPER ONLY',
    cmds: ['eval', 'restart', 'shutdown', 'block', 'unblock',
           'setpp', 'setbotpp', 'setname', 'setbotname', 'setbio',
           'post', 'vv', 'save', 'repost', 'mode', 'storage',
           'broadcast', 'setprefix', 'setmenuimage', 'setnewsletter',
           'newsletter', 'update', 'anticall', 'antidelete'],
    icons: { eval: '💻', restart: '🔄', shutdown: '🛑', block: '❌',
             unblock: '✅', setpp: '🖼', setbotpp: '🖼', setname: '📝',
             setbotname: '📝', setbio: '💭', post: '📤', vv: '👁',
             save: '💾', repost: '♻️', mode: '⚙️', storage: '💽',
             broadcast: '📢', setprefix: '⚡', setmenuimage: '🖼',
             setnewsletter: '📡', newsletter: '📡', update: '⬆️',
             anticall: '📵', antidelete: '🗑️' }
  }
];

function fmtRuntime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

module.exports = {
  name: 'menu',
  aliases: ['help', 'commands'],
  category: 'general',
  description: 'Show all available commands',
  usage: '.menu',

  async execute(sock, msg, args, extra) {
    try {
      const commands = loadCommands();
      const have = new Set();
      commands.forEach((cmd, name) => { if (cmd && cmd.name === name) have.add(name); });

      // Resolve sender / display name
      const rawSender = extra.sender || msg.key.participant || msg.key.remoteJid || '';
      let mentionJid = rawSender;
      try {
        const norm = normalizeJidWithLid(rawSender);
        if (norm) mentionJid = norm;
      } catch {}
      const displayName =
        (msg.pushName && msg.pushName.trim()) ||
        String(mentionJid).split('@')[0] ||
        'there';

      const ownerName = Array.isArray(config.ownerName)
        ? config.ownerName[0] : (config.ownerName || 'Owner');
      const isPrivate = !!accountSettings.get(sock, 'selfMode');

      const sections = [];

      // ── Header block ─────────────────────────────
      sections.push({
        title: 'VOLTRA MD',
        lines: [
          `👋 *User:* @${String(mentionJid).split('@')[0]}`,
          `⚡ *Prefix:* [ ${config.prefix} ]`,
          `👑 *Owner:* ${ownerName}`,
          `🚀 *Mode:* ${isPrivate ? 'private' : 'public'}`,
          `🧠 *Engine:* Voltra Quantum Core v3.0`,
          `⏱ *Runtime:* ${fmtRuntime(process.uptime())}`,
        ],
      });

      // ── Command sections ─────────────────────────
      for (const def of SECTION_DEFS) {
        const lines = [];
        for (const c of def.cmds) {
          if (!have.has(c)) continue;
          const ico = def.icons[c] || '•';
          lines.push(`${ico} ${config.prefix}${c}`);
        }
        if (lines.length) sections.push({ title: def.title, lines });
      }

      // ── Catch-all: any remaining commands not in SECTION_DEFS ──
      const placed = new Set(SECTION_DEFS.flatMap(d => d.cmds));
      const leftovers = Array.from(have).filter(n => !placed.has(n)).sort();
      if (leftovers.length) {
        sections.push({
          title: 'EXTRAS',
          lines: leftovers.map(n => `• ${config.prefix}${n}`),
        });
      }

      const menuText =
        multiBox(sections) +
        `\n\n┌────────────────────┐\n│ 📡 *VOLTRA ENGINE v3.0*\n└────────────────────┘`;

      const ctx = {
        mentionedJid: [mentionJid],
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: config.newsletterJid,
          newsletterName: config.newsletterName || 'Voltra Tech',
          serverMessageId: -1
        }
      };

      const imgPng = path.join(__dirname, '../../utils/bot.png');
      const imgJpg = path.join(__dirname, '../../utils/bot_image.jpg');
      const imgFile = fs.existsSync(imgPng) ? imgPng :
                      (fs.existsSync(imgJpg) ? imgJpg : null);

      if (imgFile) {
        await sock.sendMessage(extra.from, {
          image: fs.readFileSync(imgFile),
          caption: menuText,
          contextInfo: ctx,
          mentions: [mentionJid]
        }, { quoted: msg });
      } else {
        await sock.sendMessage(extra.from, {
          text: menuText,
          contextInfo: ctx,
          mentions: [mentionJid]
        }, { quoted: msg });
      }
    } catch (error) {
      console.error('[menu] error:', error);
      try { await extra.reply(`❌ Menu error: ${error.message}`); } catch {}
    }
  }
};
