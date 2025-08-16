
const axios = require('axios');

module.exports = {
  name: 'ai',
  description: 'Chat with AI',
  role: 0,
  conversation: {},
  execute: async (api, message, args, db, settings, getText, onChat, onReply) => {
    onChat({
      useNameWithoutPrefix: true,
    });

    const prompt = args.join(' ');
    if (!prompt && message.body.startsWith(settings.prefix)) {
      api.sendMessage('Please provide a prompt.', message.threadID);
      return;
    }

    const userPrompt = message.body.startsWith(settings.prefix) ? prompt : message.body;

    if (!module.exports.conversation[message.threadID]) {
      module.exports.conversation[message.threadID] = {
        context: '',
      };
    }

    try {
      const response = await axios.get('https://titan-ai-n2lt.onrender.com/generate/?q=' + userPrompt);

      const reply = response.data.reply;
      module.exports.conversation[message.threadID].context += `\nUser: ${userPrompt}\nAI: ${reply}`;
      api.sendMessage(reply, message.threadID, (err, info) => {
        onReply({
          type: 'continue',
          name: module.exports.name,
          messageID: info.messageID,
        });
      });
    } catch (error) {
      console.error(error);
      api.sendMessage('Error occurred while generating response.', message.threadID);
    }
  },
};
