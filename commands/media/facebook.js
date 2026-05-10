/**
 * Facebook Downloader — multi-API fallback chain.
 * Tries siputzx → dreaded → nexray. Whichever returns a usable HD/SD URL
 * first wins. No more single-point-of-failure.
 */

const config = require('../../config');
const { downloadFacebook, fetchBuffer } = require('../../utils/downloaders');

const processed = new Set();

const FB_PATTERNS = [
  /https?:\/\/(?:www\.|m\.)?facebook\.com\//i,
  /https?:\/\/(?:www\.|m\.)?fb\.com\//i,
  /https?:\/\/fb\.watch\//i,
];

module.exports = {
  name: 'facebook',
  aliases: ['fb', 'fbdl', 'facebookdl'],
  category: 'media',
  description: 'Download Facebook videos (multi-API fallback)',
  usage: '.facebook <Facebook URL>',

  async execute(sock, msg, args, extra) {
    try {
      if (processed.has(msg.key.id)) return;
      processed.add(msg.key.id);
      setTimeout(() => processed.delete(msg.key.id), 5 * 60 * 1000);

      const text = (args.join(' ') || msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
      const url = (text.match(/https?:\/\/\S+/) || [])[0];
      if (!url) return extra.reply('📥 *Facebook Downloader*\n\nUsage: .facebook <link>');
      if (!FB_PATTERNS.some(re => re.test(url))) return extra.reply('❌ Not a valid Facebook link.');

      await sock.sendMessage(extra.from, { react: { text: '🔄', key: msg.key } });

      const result = await downloadFacebook(url);
      if (!result.ok) {
        console.error('[facebook] all sources failed:', result.tried);
        return extra.reply('❌ All Facebook download sources failed. Please try again or use a different link.');
      }

      // Try buffer first (more reliable for large videos), fallback to URL.
      try {
        const buf = await fetchBuffer(result.url, { headers: { Referer: 'https://www.facebook.com/' } });
        if (!buf?.length) throw new Error('empty buffer');
        await sock.sendMessage(extra.from, {
          video: buf,
          mimetype: 'video/mp4',
          caption: `*DOWNLOADED BY ${config.botName.toUpperCase()}*\n_source: ${result.source}_`,
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(extra.from, {
          video: { url: result.url },
          mimetype: 'video/mp4',
          caption: `*DOWNLOADED BY ${config.botName.toUpperCase()}*\n_source: ${result.source}_`,
        }, { quoted: msg });
      }
    } catch (err) {
      console.error('[facebook] command error:', err);
      await extra.reply(`❌ Error: ${err.message || 'unknown'}`);
    }
  }
};
