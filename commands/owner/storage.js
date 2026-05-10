/**
 * .storage — Show current disk usage statistics (owner only)
 */
const { getStorageStats } = require('../../utils/cleanup');

module.exports = {
  name: 'storage',
  aliases: ['diskstats', 'storagestats'],
  category: 'owner',
  description: 'Show bot disk usage statistics',
  ownerOnly: true,
  async execute(sock, m, { reply }) {
    try {
      const s = await getStorageStats();
      const bar = (() => {
        const pct = Math.min(1, s.usedBytes / s.thresholdBytes);
        const filled = Math.round(pct * 20);
        return '█'.repeat(filled) + '░'.repeat(20 - filled);
      })();
      const text =
`╭─「 *VOLTRA STORAGE* 」
│ 📦 Used: *${s.usedHuman}*
│ 🚦 Limit: *${s.thresholdHuman}*
│ 📊 ${bar} ${s.pct}
│
│ ♻️ Auto-cleanup runs every 10 min
│ 🛡️ Sessions, DBs & configs are protected
╰────────────────`;
      await reply(text);
    } catch (e) {
      await reply(`❌ Failed to read storage: ${e.message}`);
    }
  },
};
