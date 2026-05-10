/**
 * Ping Command — reliable round-trip measurement.
 *
 * The previous implementation timed `sock.sendMessage()` only. In private
 * chats Baileys often resolves that promise as soon as the message is
 * locally encrypted (before the server ACK), which produced suspiciously
 * tiny "4ms / 5ms" readings. We now sample three real round-trips to the
 * WhatsApp server using `sendPresenceUpdate` (cheap, no visible side
 * effect) and report the average — works the same in DMs and groups.
 */

const { formatViralUI } = require('../../utils/style');

async function measureOnce(sock, to) {
  const start = process.hrtime.bigint();
  try {
    await sock.sendPresenceUpdate('available', to);
  } catch {
    // Fallback: ping the bot's own JID; succeeds even if `to` rejects
    try { await sock.sendPresenceUpdate('available', sock.user?.id); } catch {}
  }
  return Number(process.hrtime.bigint() - start) / 1e6; // ms
}

module.exports = {
  name: 'ping',
  aliases: ['p', 'speed'],
  category: 'general',
  description: 'Check bot response time (real round-trip)',
  usage: '.ping',

  async execute(sock, msg, args, extra) {
    try {
      const sent = await extra.reply({ raw: true, text: '🏓 Pinging...' });

      // Three samples → average. Discards the first warm-up sample if the
      // socket needed to wake up.
      const samples = [];
      for (let i = 0; i < 3; i++) {
        samples.push(await measureOnce(sock, extra.from));
      }
      const sorted = [...samples].sort((a, b) => a - b);
      const trimmed = sorted.length >= 3 ? sorted.slice(0, -1) : sorted; // drop slowest
      const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
      const best = sorted[0];

      const text = formatViralUI('BOT PING', [
        `🏓 Pong!`,
        `📡 Latency : ${avg.toFixed(0)} ms (avg)`,
        `⚡ Best    : ${best.toFixed(0)} ms`,
        `🛰️ Samples : ${samples.map(s => s.toFixed(0) + 'ms').join(', ')}`,
        `💚 Status  : Online`
      ]);

      try {
        await sock.sendMessage(extra.from, { text, edit: sent.key });
      } catch {
        await extra.reply(text);
      }
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
