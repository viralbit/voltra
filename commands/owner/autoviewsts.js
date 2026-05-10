/**
 * .autoviewsts — auto-view incoming WhatsApp statuses (per-account).
 */

const accountSettings = require('../../utils/accountSettings');

module.exports = {
  name: 'autoviewsts',
  aliases: ['autoviewstatus', 'autoseests'],
  category: 'owner',
  description: 'Automatically view incoming WhatsApp statuses (this account only)',
  usage: '.autoviewsts <on/off>',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    const me = accountSettings.botNumber(sock) || 'this account';
    const opt = (args[0] || '').toLowerCase();
    if (opt !== 'on' && opt !== 'off') {
      const cur = accountSettings.get(sock, 'autoViewStatus') ? 'ON' : 'OFF';
      return extra.reply(`📋 *Auto-View Status* (${me}) — currently *${cur}*\n\n• .autoviewsts on\n• .autoviewsts off\n\n_This setting is per-account._`);
    }
    try {
      accountSettings.set(sock, 'autoViewStatus', opt === 'on');
      return extra.reply(opt === 'on'
        ? `✅ *${me}* — auto-view statuses *enabled*.`
        : `❌ *${me}* — auto-view statuses *disabled*.`);
    } catch (e) {
      console.error('[autoviewsts] error:', e);
      return extra.reply('❌ Failed to update setting: ' + e.message);
    }
  }
};
