/**
 * Alive Command — VOLTRA MD (Double-Line Box)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('../../config');
const { formatViralUI } = require('../../utils/style');

function uptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

module.exports = {
  name: 'alive',
  aliases: ['status'],
  category: 'general',
  description: 'Show bot status',
  usage: '.alive',

  async execute(sock, msg, args, extra) {
    const pushName = msg.pushName || (extra.sender || '').split('@')[0] || 'there';
    const text = formatViralUI('BOT STATUS', [
      `❤️‍🔥 ${config.botName} is Alive!`,
      `👤 User: ${pushName}`,
      `🟢 Status: Running`,
      `⏱ Uptime: ${uptime(process.uptime())}`,
      `💾 RAM: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB`,
      `🖥 Platform: ${os.platform()} ${os.arch()}`,
      `⚡ Prefix: ${config.prefix}`,
      `👑 Dev: ${config.developer || 'Calyx Drey'}`,
      `🚀 Brand: VOLTRA MD`
    ]);

    const ctx = {
      mentionedJid: [extra.sender],
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: config.newsletterJid,
        newsletterName: config.newsletterName || 'Voltra Tech',
        serverMessageId: -1
      }
    };

    const imagePath = path.join(__dirname, '../../utils/bot.png');
    const fallbackImg = path.join(__dirname, '../../utils/bot_image.jpg');
    const imgFile = fs.existsSync(imagePath) ? imagePath : (fs.existsSync(fallbackImg) ? fallbackImg : null);

    try {
      if (imgFile) {
        await sock.sendMessage(extra.from, {
          image: fs.readFileSync(imgFile),
          caption: text,
          contextInfo: ctx
        }, { quoted: msg });
      } else {
        await sock.sendMessage(extra.from, { text, contextInfo: ctx }, { quoted: msg });
      }
    } catch (e) {
      await extra.reply({ raw: true, text });
    }
  }
};
