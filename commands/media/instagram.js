/**
 * Instagram Downloader — multi-API fallback (siputzx → nexray → dreaded).
 */

const config = require('../../config');
const { downloadInstagram } = require('../../utils/downloaders');

const processed = new Set();
const IG_RE = /https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\//i;

module.exports = {
  name: 'instagram',
  aliases: ['ig', 'insta', 'igdl', 'reels'],
  category: 'media',
  description: 'Download Instagram photos/videos/reels (multi-API fallback)',
  usage: '<Instagram URL>',

  async execute(sock, msg, args, extra) {
    try {
      if (processed.has(msg.key.id)) return;
      processed.add(msg.key.id);
      setTimeout(() => processed.delete(msg.key.id), 5 * 60 * 1000);

      const text = (args.join(' ') || msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
      const url = (text.match(/https?:\/\/\S+/) || [])[0];
      if (!url || !IG_RE.test(url)) return extra.reply('❌ Please provide a valid Instagram link.');

      await sock.sendMessage(extra.from, { react: { text: '🔄', key: msg.key } });

      const r = await downloadInstagram(url);
      if (!r.ok) {
        console.error('[instagram] all sources failed:', r.tried);
        return extra.reply('❌ All Instagram download sources failed. The post may be private or removed.');
      }

      const caption = `*DOWNLOADED BY ${config.botName.toUpperCase()}*\n_source: ${r.source}_`;
      const urls = (r.urls || [r.url]).filter(Boolean).slice(0, 10);

      for (const u of urls) {
        const isVideo = /\.(mp4|mov|m4v|webm)(\?|$)/i.test(u);
        try {
          if (isVideo) {
            await sock.sendMessage(extra.from, { video: { url: u }, mimetype: 'video/mp4', caption }, { quoted: msg });
          } else {
            await sock.sendMessage(extra.from, { image: { url: u }, caption }, { quoted: msg });
          }
        } catch (e) {
          console.warn('[instagram] send failed:', e.message);
        }
      }
    } catch (err) {
      console.error('[instagram] command error:', err);
      await extra.reply(`❌ Error: ${err.message || 'unknown'}`);
    }
  }
};
