/**
 * .anticall — auto-reject and block calls (per-account).
 *
 * The handler reads `accountSettings.get(sock, 'anticall')` inside the
 * Baileys 'call' event listener (see handler.initializeAntiCall), so this
 * toggle takes effect immediately without restarting the session.
 */

const accountSettings = require('../../utils/accountSettings');

module.exports = {
  name: 'anticall',
  category: 'owner',
  ownerOnly: true,
  description: 'Auto-reject and block incoming calls (this account only)',
  usage: '.anticall on/off',

  async execute(sock, msg, args, extra) {
    const me = accountSettings.botNumber(sock) || 'this account';
    const opt = (args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(opt)) {
      const cur = accountSettings.get(sock, 'anticall') ? 'ON' : 'OFF';
      return extra.reply(`📞 *Anti-Call* (${me}) — currently *${cur}*\n\nUsage: .anticall on/off\n\n_This setting is per-account._`);
    }

    try {
      accountSettings.set(sock, 'anticall', opt === 'on');
      await extra.reply(opt === 'on'
        ? `✅ *${me}* — anti-call *enabled*. Calls will be auto-rejected & blocked.`
        : `❌ *${me}* — anti-call *disabled*.`);
    } catch (err) {
      console.error('[anticall cmd] error:', err);
      extra.reply('❌ Error updating anti-call setting.');
    }
  }
};
