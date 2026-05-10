/**
 * .mode — toggle PRIVATE / PUBLIC for THIS linked account only.
 *
 * Per-account: running `.mode private` on one linked WhatsApp does NOT
 * affect any other linked account. Stored in database/accounts.json via
 * utils/accountSettings.
 */

const accountSettings = require('../../utils/accountSettings');

module.exports = {
  name: 'mode',
  aliases: ['botmode', 'privatemode', 'publicmode'],
  description: 'Toggle THIS account between private and public mode',
  usage: '.mode <private/public>',
  category: 'owner',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const me = accountSettings.botNumber(sock) || 'this account';
      const current = !!accountSettings.get(sock, 'selfMode');

      if (!args[0]) {
        const description = current
          ? 'Only owner and sudo users can use commands'
          : 'Everyone can use commands';
        return extra.reply(
          `🤖 *Bot Mode* (${me})\n\n` +
          `Current Mode: *${current ? 'PRIVATE' : 'PUBLIC'}*\n` +
          `Status: ${description}\n\n` +
          `Usage:\n` +
          `  .mode private — only owner can use\n` +
          `  .mode public  — everyone can use\n\n` +
          `_This setting is per-account. Other linked numbers are unaffected._`
        );
      }

      const mode = String(args[0]).toLowerCase();

      if (mode === 'private' || mode === 'priv') {
        if (current) return extra.reply(`🔒 *${me}* is already in *PRIVATE* mode.`);
        accountSettings.set(sock, 'selfMode', true);
        return extra.reply(`🔒 *${me}* — mode set to *PRIVATE*. Only owners can use commands now.\n\n_Other linked accounts are unaffected._`);
      }

      if (mode === 'public' || mode === 'pub') {
        if (!current) return extra.reply(`🌐 *${me}* is already in *PUBLIC* mode.`);
        accountSettings.set(sock, 'selfMode', false);
        return extra.reply(`🌐 *${me}* — mode set to *PUBLIC*. Everyone can use commands now.\n\n_Other linked accounts are unaffected._`);
      }

      return extra.reply('❌ Invalid mode!\nUsage: .mode <private/public>');
    } catch (error) {
      console.error('Mode command error:', error);
      await extra.reply('❌ Error changing bot mode.');
    }
  }
};
