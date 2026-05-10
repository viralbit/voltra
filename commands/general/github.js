/**
 * GitHub Command — VOLTRA MD (plain style)
 */

const axios = require('axios');
const config = require('../../config');

const REPO_URL = 'https://github.com/voltra/voltra-md';
const API_URL  = 'https://api.github.com/repos/voltra/voltra-md';

module.exports = {
  name: 'github',
  aliases: ['repo', 'git', 'source', 'sc', 'script'],
  category: 'general',
  description: 'Show bot GitHub repository and statistics',
  usage: '.github',
  ownerOnly: false,

  async execute(sock, msg, args, extra) {
    try {
      const chatId = extra.from;
      const loadingMsg = await extra.reply('🔍 Fetching GitHub repository information...');

      try {
        const response = await axios.get(API_URL, {
          headers: { 'User-Agent': 'VOLTRA-MINI' },
          timeout: 10000
        });
        const repo = response.data;

        const text =
`💻 *GITHUB REPOSITORY*

🔗 Name   : ${repo.name}
👨‍💻 Owner  : ${repo.owner.login}
🌐 Link   : ${repo.html_url}

⭐ Stars  : ${repo.stargazers_count.toLocaleString()}
🍴 Forks  : ${repo.forks_count.toLocaleString()}
👁 Watch  : ${repo.watchers_count.toLocaleString()}
📦 Size   : ${(repo.size / 1024).toFixed(2)} MB

📥 Clone:
git clone ${repo.clone_url}

> ${config.botName} • ${config.developer}`;

        await sock.sendMessage(chatId, { text, edit: loadingMsg.key });
      } catch (apiError) {
        console.error('GitHub API Error:', apiError.message);
        const text =
`💻 *GITHUB REPOSITORY*

🔗 ${REPO_URL}

⚠️ Live stats unavailable. Visit the repo for updates.

> ${config.botName} • ${config.developer}`;
        await sock.sendMessage(chatId, { text, edit: loadingMsg.key });
      }
    } catch (error) {
      console.error('GitHub command error:', error);
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
