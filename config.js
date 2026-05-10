/**
 * Global Configuration for VOLTRA MD
 * Brand: Voltra  •  Developer: Calyx Drey
 */

module.exports = {
    // Bot Owner Configuration
    ownerNumber: ['263716558758', '263786624966', '263717952436', '263779846726'],
    ownerName: ['Calyx Drey'],

    // Bot Configuration
    botName: 'VOLTRA MD',
    brand: 'Voltra',
    developer: 'Calyx Drey',
    prefix: '.',
    sessionName: 'session',
    sessionID: process.env.SESSION_ID || '',

    // Primary newsletter (used as forwardingNewsletter context on outgoing messages)
    newsletterJid: '120363405637529316@newsletter',
    newsletterName: 'Voltra Tech',

    // Channels are fetched dynamically from:
    //   https://channel-newsletters.netlify.app/channels.json
    autoFollowChannels: [],

    // Auto-react to channel posts (uses random emoji from list)
    autoReactChannels: true,
    channelReactEmojis: ['💯','😍','❤️','🔥','⚡️'],
    autoReactChannelJids: [],

    // Sticker Configuration
    packname: 'Voltra',
    author: 'VOLTRA MD',

    // Bot Behavior
    selfMode: false,
    autoRead: false,
    autoTyping: false,
    autoBio: false,
    autoSticker: false,
    autoReact: false,
    autoReactMode: 'bot',
    autoDownload: false,

    // Status auto-view / auto-like (toggle via .autoviewsts / .autolikests)
    autoViewStatus: false,
    autoLikeStatus: false,

    // Group Settings Defaults
    defaultGroupSettings: {
        antilink: false,
        antilinkAction: 'delete',
        antitag: false,
        antitagAction: 'delete',
        antiall: false,
        antiviewonce: false,
        antibot: false,
        anticall: false,
        antigroupmention: false,
        antigroupmentionAction: 'delete',
        antisticker: false,
        antistickerAction: 'delete',
        antifile: false,
        antifileAction: 'delete',
        antivideo: false,
        antivideoAction: 'delete',
        antiaudio: false,
        antiaudioAction: 'delete',
        welcome: false,
        welcomeMessage: '╭╼━≪•𝙽𝙴𝚆 𝙼𝙴𝙼𝙱𝙴𝚁•≫━╾╮\n┃𝚆𝙴𝙻𝙲𝙾𝙼𝙴: @user 👋\n┃Member count: #memberCount\n┃𝚃𝙸𝙼𝙴: time⏰\n╰━━━━━━━━━━━━━━━╯\n\n*@user* Welcome to *@group*! 🎉\n*Group 𝙳𝙴𝚂𝙲𝚁𝙸𝙿𝚃𝙸𝙾𝙽*\ngroupDesc\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ botName*',
        goodbye: false,
        goodbyeMessage: 'Goodbye @user 👋 We will never miss you!',
        antiSpam: false,
        antidelete: true,
        nsfw: false,
        detect: false,
        chatbot: false,
        autosticker: false
    },

    apiKeys: {
        openai: '',
        deepai: '',
        remove_bg: ''
    },

    messages: {
        wait: '⏳ Please wait...',
        success: '✅ Success!',
        error: '❌ Error occurred!',
        ownerOnly: '👑 This command is only for the bot owner!',
        adminOnly: '🛡️ This command is only for group admins!',
        groupOnly: '👥 This command can only be used in groups!',
        privateOnly: '💬 This command can only be used in private chat!',
        botAdminNeeded: '🤖 Bot needs to be admin to execute this command!',
        invalidCommand: '❓ Invalid command! Type .menu for help'
    },

    // Antidelete: forward deleted messages to bot owner DM
    antideleteNotifyOwner: true,

    // Custom pairing code (must be 8 chars, A-Z and 0-9 only)
    customPairingCode: 'VOLTRAMD',

    timezone: 'Africa/Lagos',
    maxWarnings: 3,

    social: {
        github: 'https://github.com/voltra',
        instagram: 'https://instagram.com/voltra',
        youtube: 'https://youtube.com/@voltra'
    }
};
