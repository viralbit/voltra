/**
 * Pinterest Downloader — multi-API fallback (nexray → siputzx).
 */

const config = require('../../config');
const { downloadPinterest, fetchBuffer } = require('../../utils/downloaders');

const processed = new Set();

module.exports = {
  name: 'pinterest',
  aliases: ['pin', 'pindl', 'pinterestdl'],
  category: 'media',
  description: 'Download images/videos from Pinterest (multi-API fallback)',
  usage: '.pinterest <Pinterest URL>',

  async execute(sock, msg, args, extra) {
    try {
      if (processed.has(msg.key.id)) return;
      processed.add(msg.key.id);
      setTimeout(() => processed.delete(msg.key.id), 5 * 60 * 1000);

      const text = (args.join(' ') || msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
      const url = (text.match(/https?:\/\/\S*pinterest\S+|https?:\/\/pin\.it\/\S+/i) || [])[0];
      if (!url) return extra.reply('📌 *Pinterest Downloader*\n\nUsage: .pinterest <pin or pin.it URL>');

      await sock.sendMessage(extra.from, { react: { text: '📥', key: msg.key } });

      const r = await downloadPinterest(url);
      if (!r.ok) {
        console.error('[pinterest] all sources failed:', r.tried);
        return extra.reply('❌ All Pinterest download sources failed.');
      }

      const caption = `📌 *${r.title || 'Pinterest Pin'}*${r.author ? `\n👤 ${r.author}` : ''}\n\n*Downloaded by ${config.botName}* _(via ${r.source})_`;

      if (r.type === 'video') {
        try {
          const buf = await fetchBuffer(r.url, { headers: { Referer: 'https://www.pinterest.com/' } });
          await sock.sendMessage(extra.from, { video: buf, caption }, { quoted: msg });
        } catch {
          await sock.sendMessage(extra.from, { video: { url: r.url }, caption }, { quoted: msg });
        }
      } else {
        await sock.sendMessage(extra.from, { image: { url: r.url }, caption }, { quoted: msg });
      }
    } catch (err) {
      console.error('[pinterest] command error:', err);
      await extra.reply(`❌ Error: ${err.message || 'unknown'}`);
    }
  }
};
