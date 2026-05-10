/**
 * Uptime Command - Display bot uptime since it was started
 */

const config = require('../../config');
const { formatViralUI } = require('../../utils/style');

function formatUptime(seconds) {
  if (seconds <= 0) return '0 seconds';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

module.exports = {
  name: 'uptime',
  aliases: ['runtime', 'botuptime'],
  category: 'general',
  description: 'Show how long the bot has been running',
  usage: '.uptime',

  async execute(sock, msg, args, extra) {
    try {
      const uptime = formatUptime(process.uptime());
      const pushName = msg.pushName || (extra.sender || '').split('@')[0] || 'there';

      const text = formatViralUI('BOT UPTIME', [
        `🤖 Name: ${config.botName || 'VOLTRA MD'}`,
        `👤 User: ${pushName}`,
        `⏳ Time: ${uptime}`,
        `⚡ Prefix: ${config.prefix}`,
        `🚀 Brand: VOLTRA MD`
      ]);

      await extra.reply({ raw: true, text });
    } catch (error) {
      console.error('Error in uptime command:', error);
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
