/**
 * .autotyping — show typing indicator before responding to commands
 * (per-account).
 */

const accountSettings = require('../../utils/accountSettings');

module.exports = {
  name: 'autotyping',
  aliases: ['autotype'],
  category: 'owner',
  description: 'Show typing indicator before responding (this account only)',
  usage: '.autotyping <on/off>',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    const me = accountSettings.botNumber(sock) || 'this account';
    const opt = (args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(opt)) {
      const cur = accountSettings.get(sock, 'autoTyping') ? 'ON' : 'OFF';
      return extra.reply(`⌨️ *Auto-Typing* (${me}) — currently *${cur}*\n\nUsage: .autotyping on/off\n\n_This setting is per-account._`);
    }
    accountSettings.set(sock, 'autoTyping', opt === 'on');
    return extra.reply(opt === 'on'
      ? `✅ *${me}* — auto-typing *enabled*.`
      : `❌ *${me}* — auto-typing *disabled*.`);
  }
};
