/**
 * .autoreact — react to messages in groups + private chats (per-account).
 */

const accountSettings = require('../../utils/accountSettings');

module.exports = {
  name: 'autoreact',
  aliases: ['ar'],
  category: 'owner',
  description: 'Auto-react to incoming messages (this account only)',
  usage: '.autoreact <on/off/set bot/set all>',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const me = accountSettings.botNumber(sock) || 'this account';
      const enabled = !!accountSettings.get(sock, 'autoReact');
      const mode = accountSettings.get(sock, 'autoReactMode') || 'bot';

      if (!args[0]) {
        return extra.reply(
`📋 *Auto-React* (${me}) — *${enabled ? 'ON' : 'OFF'}* (mode: *${mode}*)

• .autoreact on  — enable auto-react
• .autoreact off — disable auto-react
• .autoreact set bot — react ⏳ to commands only
• .autoreact set all — react random emoji to every message

🚫 Channels, statuses and broadcasts are never reacted to here.
   (Use .autolikests for status reactions.)

_This setting is per-account._`
        );
      }

      const opt = args.join(' ').toLowerCase();

      if (opt === 'on') {
        accountSettings.set(sock, 'autoReact', true);
        return extra.reply(`✅ *${me}* — auto-react *enabled*.`);
      }

      if (opt === 'off') {
        accountSettings.set(sock, 'autoReact', false);
        return extra.reply(`❌ *${me}* — auto-react *disabled*.`);
      }

      if (opt === 'set bot') {
        accountSettings.set(sock, 'autoReactMode', 'bot');
        return extra.reply(`🤖 *${me}* — mode set: react ⏳ to bot commands only.`);
      }

      if (opt === 'set all') {
        accountSettings.set(sock, 'autoReactMode', 'all');
        return extra.reply(`🌟 *${me}* — mode set: random-emoji react to every message.`);
      }

      extra.reply('❌ Invalid option. Use: on | off | set bot | set all');
    } catch (err) {
      console.error('[autoreact cmd] error:', err);
      extra.reply('❌ Error configuring auto-react.');
    }
  }
};
