module.exports = {
  name: 'user',
  description: 'Manage users: add, remove, update. Usage: !user <add|remove|update> <userID> [name]',
  role: 2, // bot admin or above
  async execute(api, message, args, db, settings, t) {
    const action = args.shift();
    const userID = args.shift();
    await db.read();
    let response = '';
    if (!action || !userID) {
      return api.sendMessage(
        `Usage:\n${settings.prefix}user add <userID> <name>\n${settings.prefix}user remove <userID>\n${settings.prefix}user update <userID> <newName>`,
        message.threadID
      );
    }
    if (action === 'add') {
      const name = args.join(' ');
      if (!name) return api.sendMessage(`Usage: ${settings.prefix}user add <userID> <name>`, message.threadID);
      if (!db.data.users.find(u => u.userID === userID)) {
        let userRole = 0;
        if (settings.ownerID === userID) userRole = 3;
        else if (settings.adminIDs.includes(userID)) userRole = 2;
        db.data.users.push({ userID, name, coins: 0, role: userRole });
        response = t('addedUser', { name, userID });
      } else {
        response = 'User already exists.';
      }
    } else if (action === 'remove') {
      const before = db.data.users.length;
      db.data.users = db.data.users.filter(u => u.userID !== userID);
      if (db.data.users.length < before) {
        response = t('removedUser', { userID });
      } else {
        response = t('userNotFound');
      }
    } else if (action === 'update') {
      const newName = args.join(' ');
      if (!newName) return api.sendMessage(`Usage: ${settings.prefix}user update <userID> <newName>`, message.threadID);
      const user = db.data.users.find(u => u.userID === userID);
      if (!user) return api.sendMessage(t('userNotFound'), message.threadID);
      user.name = newName;
      response = t('updatedUser', { userID, newName });
    } else {
      response = `Unknown action. Use add, remove, or update.`;
    }
    await db.write();
    api.sendMessage(response, message.threadID);
  }
};
