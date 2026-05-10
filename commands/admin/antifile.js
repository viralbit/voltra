/**
 * Antifile Command - Toggle anti-file (documents) protection (delete/kick)
 */

const database = require('../../database');

module.exports = {
  name: 'antifile',
  aliases: [],
  category: 'admin',
  description: 'Configure anti-file (documents) protection (delete/kick)',
  usage: '.antifile <on/off/set/get>',
  groupOnly: true,
  adminOnly: true,
  botAdminNeeded: true,

  async execute(sock, msg, args, extra) {
    try {
      const settings = database.getGroupSettings(extra.from);
      if (!args[0]) {
        const status = settings.antifile ? 'ON' : 'OFF';
        const action = settings.antifileAction || 'delete';
        return extra.reply(
          `📁 *Antifile Status*\n\n` +
          `Status: *${status}*\n` +
          `Action: *${action}*\n\n` +
          `Usage:\n` +
          `  .antifile on\n` +
          `  .antifile off\n` +
          `  .antifile set delete | kick\n` +
          `  .antifile get`
        );
      }
      const opt = args[0].toLowerCase();
      if (opt === 'on')  { database.updateGroupSettings(extra.from, { antifile: true  }); return extra.reply('*Antifile has been turned ON*'); }
      if (opt === 'off') { database.updateGroupSettings(extra.from, { antifile: false }); return extra.reply('*Antifile has been turned OFF*'); }
      if (opt === 'set') {
        const a = (args[1] || '').toLowerCase();
        if (!['delete','kick'].includes(a)) return extra.reply('*Invalid action. Choose delete or kick.*');
        database.updateGroupSettings(extra.from, { antifileAction: a, antifile: true });
        return extra.reply(`*Antifile action set to ${a}*`);
      }
      if (opt === 'get') {
        const status = settings.antifile ? 'ON' : 'OFF';
        const action = settings.antifileAction || 'delete';
        return extra.reply(`*Antifile Configuration:*\nStatus: ${status}\nAction: ${action}`);
      }
      return extra.reply('*Use .antifile for usage.*');
    } catch (e) { await extra.reply(`❌ Error: ${e.message}`); }
  }
};
