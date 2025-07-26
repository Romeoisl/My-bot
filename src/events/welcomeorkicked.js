const settings = require('../../settings.json');

const BOT_ID = api.getCurrentUserID() || "";

module.exports = {
  default: {
    eventType: ['log:subscribe', 'log:unsubscribe'],
    run: async (api, event) => {
      // === Handle Added Participants ===
      if (event.logMessageType === 'log:subscribe') {
        const addedParticipants = event.logMessageData?.addedParticipants || [];
        const isBotAdded = addedParticipants.some(participant => participant.userFbId === BOT_ID);

        if (isBotAdded) {
          api.sendMessage(settings.welcomeMessage || "Hello! I'm your new bot.", event.threadID);

          for (const adminID of settings.adminIDs) {
            if (adminID) {
              api.sendMessage(
                `Bot added to group: ${event.threadName || event.threadID}\nGroup ID: ${event.threadID}\nTime: ${new Date().toLocaleString()}`,
                adminID
              );
            }
          }
        } else {
          for (const participant of addedParticipants) {
            api.sendMessage(
              `Welcome ${participant.fullName || "Facebook User"} to the group! Have a great stay.`,
              event.threadID
            );
          }
        }
      }

      // === Handle Removed Participants ===
      if (event.logMessageType === 'log:unsubscribe') {
        const leftParticipantID = event.logMessageData?.leftParticipantFbId;
        const leftParticipantName = event.logMessageBody || "A Facebook user";

        if (leftParticipantID === BOT_ID) {
          for (const adminID of settings.adminIDs) {
            if (adminID) {
              api.sendMessage(
                `Bot was removed from group: ${event.threadName || event.threadID}\nGroup ID: ${event.threadID}\nTime: ${new Date().toLocaleString()}`,
                adminID
              );
            }
          }
        } else {
          api.sendMessage(
            `${leftParticipantName} was removed from the group.`,
            event.threadID
          );
        }
      }
    }
  }
}
