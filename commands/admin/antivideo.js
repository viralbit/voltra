/**
 * Antivideo Command - Toggle anti-video protection (delete/kick)
 */

const database = require('../../database');

module.exports = {
  name: 'antivideo',
  aliases: [],
  category: 'admin',
  description: 'Configure anti-video protection (delete/kick)',
  usage: '.antivideo <on/off/set/get>',
  groupOnly: true,
  adminOnly: true,
  botAdminNeeded: true,

  async execute(sock, msg, args, extra) {
    try {
      const settings = database.getGroupSettings(extra.from);
      if (!args[0]) {
        const status = settings.antivideo ? 'ON' : 'OFF';
        const action = settings.antivideoAction || 'delete';
        return extra.reply(
          `🎬 *Antivideo Status*\n\n` +
          `Status: *${status}*\n` +
          `Action: *${action}*\n\n` +
          `Usage:\n` +
          `  .antivideo on\n` +
          `  .antivideo off\n` +
          `  .antivideo set delete | kick\n` +
          `  .antivideo get`
        );
      }
      const opt = args[0].toLowerCase();
      if (opt === 'on')  { database.updateGroupSettings(extra.from, { antivideo: true  }); return extra.reply('*Antivideo has been turned ON*'); }
      if (opt === 'off') { database.updateGroupSettings(extra.from, { antivideo: false }); return extra.reply('*Antivideo has been turned OFF*'); }
      if (opt === 'set') {
        const a = (args[1] || '').toLowerCase();
        if (!['delete','kick'].includes(a)) return extra.reply('*Invalid action. Choose delete or kick.*');
        database.updateGroupSettings(extra.from, { antivideoAction: a, antivideo: true });
        return extra.reply(`*Antivideo action set to ${a}*`);
      }
      if (opt === 'get') {
        const status = settings.antivideo ? 'ON' : 'OFF';
        const action = settings.antivideoAction || 'delete';
        return extra.reply(`*Antivideo Configuration:*\nStatus: ${status}\nAction: ${action}`);
      }
      return extra.reply('*Use .antivideo for usage.*');
    } catch (e) { await extra.reply(`❌ Error: ${e.message}`); }
  }
};
