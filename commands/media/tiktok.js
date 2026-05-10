/**
 * TikTok Downloader — multi-API fallback (tikwm → siputzx → ssstik).
 */

const config = require('../../config');
const { downloadTikTok, fetchBuffer } = require('../../utils/downloaders');

const processed = new Set();
const TT_RE = /https?:\/\/(?:www\.|vm\.|vt\.|m\.)?tiktok\.com\//i;

module.exports = {
  name: 'tiktok',
  aliases: ['tt', 'ttdl', 'tiktokdl'],
  category: 'media',
  description: 'Download TikTok videos (multi-API fallback, no watermark)',
  usage: '.tiktok <TikTok URL>',

  async execute(sock, msg, args, extra) {
    try {
      if (processed.has(msg.key.id)) return;
      processed.add(msg.key.id);
      setTimeout(() => processed.delete(msg.key.id), 5 * 60 * 1000);

      const text = (args.join(' ') || msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
      const url = (text.match(/https?:\/\/\S+/) || [])[0];
      if (!url || !TT_RE.test(url)) return extra.reply('❌ Please provide a valid TikTok link.');

      await sock.sendMessage(extra.from, { react: { text: '🔄', key: msg.key } });

      const r = await downloadTikTok(url);
      if (!r.ok) {
        console.error('[tiktok] all sources failed:', r.tried);
        return extra.reply('❌ All TikTok download sources failed. Try again later.');
      }

      const caption = `*DOWNLOADED BY ${config.botName.toUpperCase()}*${r.title ? `\n📝 ${r.title}` : ''}${r.author ? `\n👤 @${r.author}` : ''}\n_source: ${r.source}_`;

      try {
        const buf = await fetchBuffer(r.url, { headers: { Referer: 'https://www.tiktok.com/' } });
        if (!buf?.length) throw new Error('empty buffer');
        await sock.sendMessage(extra.from, { video: buf, mimetype: 'video/mp4', caption }, { quoted: msg });
      } catch {
        await sock.sendMessage(extra.from, { video: { url: r.url }, mimetype: 'video/mp4', caption }, { quoted: msg });
      }
    } catch (err) {
      console.error('[tiktok] command error:', err);
      await extra.reply(`❌ Error: ${err.message || 'unknown'}`);
    }
  }
};
