/**
 * Antisticker Command - Toggle anti-sticker protection (delete/kick)
 */

const database = require('../../database');

module.exports = {
  name: 'antisticker',
  aliases: [],
  category: 'admin',
  description: 'Configure anti-sticker protection (delete/kick)',
  usage: '.antisticker <on/off/set/get>',
  groupOnly: true,
  adminOnly: true,
  botAdminNeeded: true,

  async execute(sock, msg, args, extra) {
    try {
      const settings = database.getGroupSettings(extra.from);
      if (!args[0]) {
        const status = settings.antisticker ? 'ON' : 'OFF';
        const action = settings.antistickerAction || 'delete';
        return extra.reply(
          `🩹 *Antisticker Status*\n\n` +
          `Status: *${status}*\n` +
          `Action: *${action}*\n\n` +
          `Usage:\n` +
          `  .antisticker on\n` +
          `  .antisticker off\n` +
          `  .antisticker set delete | kick\n` +
          `  .antisticker get`
        );
      }
      const opt = args[0].toLowerCase();
      if (opt === 'on')  { database.updateGroupSettings(extra.from, { antisticker: true  }); return extra.reply('*Antisticker has been turned ON*'); }
      if (opt === 'off') { database.updateGroupSettings(extra.from, { antisticker: false }); return extra.reply('*Antisticker has been turned OFF*'); }
      if (opt === 'set') {
        const a = (args[1] || '').toLowerCase();
        if (!['delete','kick'].includes(a)) return extra.reply('*Invalid action. Choose delete or kick.*');
        database.updateGroupSettings(extra.from, { antistickerAction: a, antisticker: true });
        return extra.reply(`*Antisticker action set to ${a}*`);
      }
      if (opt === 'get') {
        const status = settings.antisticker ? 'ON' : 'OFF';
        const action = settings.antistickerAction || 'delete';
        return extra.reply(`*Antisticker Configuration:*\nStatus: ${status}\nAction: ${action}`);
      }
      return extra.reply('*Use .antisticker for usage.*');
    } catch (e) { await extra.reply(`❌ Error: ${e.message}`); }
  }
};
