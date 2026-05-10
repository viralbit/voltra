/**
 * .antidelete — forward revoked messages to THIS account's own DM.
 * Per-account: each linked WhatsApp gets its own deleted-message log
 * delivered to its own number.
 */

const accountSettings = require('../../utils/accountSettings');

module.exports = {
  name: 'antidelete',
  aliases: ['ad'],
  category: 'owner',
  description: 'Forward revoked messages to your own DM (this account only)',
  usage: '.antidelete <on/off/status>',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const me = accountSettings.botNumber(sock) || 'this account';
      const opt = (args[0] || 'status').toLowerCase();
      const cur = !!accountSettings.get(sock, 'antideleteNotifyOwner');

      if (opt === 'on' || opt === 'off') {
        accountSettings.set(sock, 'antideleteNotifyOwner', opt === 'on');
        return extra.reply(`🗑️ *${me}* — antidelete is now *${opt === 'on' ? 'ON' : 'OFF'}*\nDeleted messages will${opt === 'on' ? '' : ' NOT'} be forwarded to your DM.`);
      }

      return extra.reply(
        `🗑️ *Antidelete Status* (${me})\n\n` +
        `Status: *${cur ? 'ON' : 'OFF'}*\n` +
        `Notifies: *${me}* (yourself)\n\n` +
        `Usage:\n  .antidelete on\n  .antidelete off\n  .antidelete status\n\n` +
        `_This setting is per-account._`
      );
    } catch (e) {
      await extra.reply(`❌ Error: ${e.message}`);
    }
  }
};
