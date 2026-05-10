/**
 * Antiaudio Command - Toggle anti-audio / voice notes protection (delete/kick)
 */

const database = require('../../database');

module.exports = {
  name: 'antiaudio',
  aliases: [],
  category: 'admin',
  description: 'Configure anti-audio / voice notes protection (delete/kick)',
  usage: '.antiaudio <on/off/set/get>',
  groupOnly: true,
  adminOnly: true,
  botAdminNeeded: true,

  async execute(sock, msg, args, extra) {
    try {
      const settings = database.getGroupSettings(extra.from);
      if (!args[0]) {
        const status = settings.antiaudio ? 'ON' : 'OFF';
        const action = settings.antiaudioAction || 'delete';
        return extra.reply(
          `🎙️ *Antiaudio Status*\n\n` +
          `Status: *${status}*\n` +
          `Action: *${action}*\n\n` +
          `Usage:\n` +
          `  .antiaudio on\n` +
          `  .antiaudio off\n` +
          `  .antiaudio set delete | kick\n` +
          `  .antiaudio get`
        );
      }
      const opt = args[0].toLowerCase();
      if (opt === 'on')  { database.updateGroupSettings(extra.from, { antiaudio: true  }); return extra.reply('*Antiaudio has been turned ON*'); }
      if (opt === 'off') { database.updateGroupSettings(extra.from, { antiaudio: false }); return extra.reply('*Antiaudio has been turned OFF*'); }
      if (opt === 'set') {
        const a = (args[1] || '').toLowerCase();
        if (!['delete','kick'].includes(a)) return extra.reply('*Invalid action. Choose delete or kick.*');
        database.updateGroupSettings(extra.from, { antiaudioAction: a, antiaudio: true });
        return extra.reply(`*Antiaudio action set to ${a}*`);
      }
      if (opt === 'get') {
        const status = settings.antiaudio ? 'ON' : 'OFF';
        const action = settings.antiaudioAction || 'delete';
        return extra.reply(`*Antiaudio Configuration:*\nStatus: ${status}\nAction: ${action}`);
      }
      return extra.reply('*Use .antiaudio for usage.*');
    } catch (e) { await extra.reply(`❌ Error: ${e.message}`); }
  }
};
