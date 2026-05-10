/**
 * Unblock Command - Unblock a user (works in DM or with mention/reply in groups)
 */

const { normalizeJidWithLid } = require('../../utils/jidHelper');

function toPnJid(jid) {
  if (!jid) return null;
  try {
    const norm = normalizeJidWithLid(jid) || jid;
    const user = norm.split('@')[0].split(':')[0];
    if (!/^\d+$/.test(user)) return null;
    return `${user}@s.whatsapp.net`;
  } catch {
    return null;
  }
}

module.exports = {
  name: 'unblock',
  aliases: [],
  category: 'owner',
  description: 'Unblock a user (use in their DM, or mention/reply in a group)',
  usage: '.unblock [@user|reply]',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      let target = null;
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const mentioned = ctx?.mentionedJid || [];

      if (mentioned.length > 0) {
        target = mentioned[0];
      } else if (ctx?.participant) {
        target = ctx.participant;
      } else if (!extra.isGroup) {
        target = extra.from;
      }

      const pn = toPnJid(target);
      if (!pn) {
        return extra.reply('❌ Use this in a user DM, or mention/reply to a user in a group.');
      }

      await sock.updateBlockStatus(pn, 'unblock');

      await sock.sendMessage(extra.from, {
        text: `✅ @${pn.split('@')[0]} has been unblocked.`,
        mentions: [pn]
      }, { quoted: msg });
    } catch (error) {
      await extra.reply(`❌ Unblock failed: ${error.message}`);
    }
  }
};
