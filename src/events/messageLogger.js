module.exports = {
  default: {
    eventType: 'message',
    run: async (api, event) => {
      console.log(`[Message] ${event.senderID} in ${event.threadID}: ${event.body}`);
    }
  }
};
