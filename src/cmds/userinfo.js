module.exports = {
  name: 'userinfo',
  description: 'Displays information about a user',
  role: 0,
  execute: async (api, message, args, db, settings, getText) => {
    let userID;

    if (args[0]) {
      // Check if the argument is a user ID
      if (!isNaN(args[0])) {
        userID = args[0];
      } else {
        // Check if the argument is a mention
        const mention = message.mentions[args[0]];
        if (mention) {
          userID = mention.id;
        }
      }
    } else {
      userID = message.senderID;
    }

    const user = db.data.users.find(u => u.userID === userID);

    if (!user) {
      api.sendMessage('User not found.', message.threadID);
      return;
    }

    api.getUserInfo(userID, (err, userInfo) => {
      if (err) {
        console.error(err);
        api.sendMessage('Error retrieving user information.', message.threadID);
        return;
      }

      const profilePicture = `https://graph.facebook.com/${userID}/picture?width=200&height=200`;
      const userData = `User ID: ${user.userID}\nName: ${userInfo[userID].name}\nCoins: ${user.coins}`;

      api.sendMessage({
        body: userData,
        attachment: api.getCurrentUserID() === userID ? null : api.getProfilePicture(userID)
      }, message.threadID);
    });
  }
};
