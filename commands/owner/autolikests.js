/**
 * .autolikests — auto-react ❤️ to incoming WhatsApp statuses (per-account).
 */

const accountSettings = require('../../utils/accountSettings');

module.exports = {
  name: 'autolikests',
  aliases: ['autolikestatus', 'autoreactsts'],
  category: 'owner',
  description: 'Automatically react ❤️ to incoming WhatsApp statuses (this account only)',
  usage: '.autolikests <on/off>',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    const me = accountSettings.botNumber(sock) || 'this account';
    const opt = (args[0] || '').toLowerCase();
    if (opt !== 'on' && opt !== 'off') {
      const cur = accountSettings.get(sock, 'autoLikeStatus') ? 'ON' : 'OFF';
      return extra.reply(`📋 *Auto-Like Status* (${me}) — currently *${cur}*\n\n• .autolikests on\n• .autolikests off\n\n_This setting is per-account._`);
    }
    try {
      accountSettings.set(sock, 'autoLikeStatus', opt === 'on');
      return extra.reply(opt === 'on'
        ? `❤️ *${me}* — auto-like statuses *enabled*.`
        : `🛑 *${me}* — auto-like statuses *disabled*.`);
    } catch (e) {
      console.error('[autolikests] error:', e);
      return extra.reply('❌ Failed to update setting: ' + e.message);
    }
  }
};
