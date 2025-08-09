module.exports = {
  name: 'start',
  description: 'Start the bot in this group',
  role: 2,
  execute: async (api, message, args, db, settings, getText, onChat) => {
    onChat({
      aliases: ['hello', 'hi', 'hey'],
      useNameWithoutPrefix: true,
    });

    if (settings.allowedGroups.includes(message.threadID)) {
      api.sendMessage('The bot is already started in this group.', message.threadID);
    } else {
      settings.allowedGroups.push(message.threadID);
      const fs = require('fs');
      fs.writeFileSync('./settings.json', JSON.stringify(settings, null, 2));
      api.sendMessage('The bot is now started in this group.', message.threadID);
    }
  },
};
