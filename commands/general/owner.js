/**
 * Owner Command - Sends bot owner's contact card (vCard)
 */

const config = require('../../config');
const { formatViralUI } = require('../../utils/style');

module.exports = {
  name: 'owner',
  aliases: ['creator', 'dev', 'botowner'],
  category: 'general',
  description: 'Show bot owner contact information',
  usage: '.owner',
  ownerOnly: false,

  async execute(sock, msg, args, extra) {
    try {
      const chatId = extra.from;

      const ownerNames = Array.isArray(config.ownerName) ? config.ownerName : [config.ownerName];
      const vCards = config.ownerNumber.map((num, index) => {
        const name = ownerNames[index] || ownerNames[0] || 'Bot Owner';
        return {
          vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;waid=${num}:${num}\nEND:VCARD`
        };
      });

      const displayName = ownerNames[0] || config.ownerName || 'Bot Owner';

      await sock.sendMessage(chatId, {
        contacts: { displayName, contacts: vCards }
      });

      const lines = [
        `👑 Owner: ${displayName}`,
        `📞 Numbers: ${config.ownerNumber.length}`,
        ...config.ownerNumber.map(n => `• +${n}`),
        `🚀 Brand: VOLTRA MD`
      ];

      await extra.reply({ raw: true, text: formatViralUI('BOT OWNER', lines) });
    } catch (error) {
      console.error('Owner command error:', error);
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
