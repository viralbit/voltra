/**
 * .autoread — automatically mark incoming GROUP messages as read
 * (per-account). Status / channel reads are handled separately by
 * .autoviewsts / .autolikests.
 */

const accountSettings = require('../../utils/accountSettings');

module.exports = {
  name: 'autoread',
  category: 'owner',
  description: 'Auto-read incoming group messages (this account only)',
  usage: '.autoread <on/off>',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    const me = accountSettings.botNumber(sock) || 'this account';
    const opt = (args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(opt)) {
      const cur = accountSettings.get(sock, 'autoRead') ? 'ON' : 'OFF';
      return extra.reply(`📖 *Auto-Read* (${me}) — currently *${cur}*\n\nUsage: .autoread on/off\n\n_This setting is per-account._`);
    }
    accountSettings.set(sock, 'autoRead', opt === 'on');
    return extra.reply(opt === 'on'
      ? `✅ *${me}* — auto-read *enabled*.`
      : `❌ *${me}* — auto-read *disabled*.`);
  }
};
