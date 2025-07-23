const login = require('ws3-fca');
const fs = require('fs');
const path = require('path');
const figlet = require("figlet");
const { Low, JSONFile } = require('lowdb');

// === Load Settings ===
const settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
figlet('Titan Botz', (err) => if(err) return);
console.log('Titan Botz - v1.0.0\nThis bot is made by Team Titan');
// === Simple Language API Loader ===
function loadLang(lang) {
  const langPath = path.join(__dirname, 'languages', `${lang}.json`);
  if (fs.existsSync(langPath)) {
    return JSON.parse(fs.readFileSync(langPath, 'utf8'));
  }
  // fallback to English
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'languages', `en.json`), 'utf8'));
}
const lang = loadLang(settings.language);

// === Language String Formatter ===
function t(key, replacements = {}) {
  let str = lang[key] || key;
  for (const [k, v] of Object.entries(replacements)) {
    str = str.replace(new RegExp(`{{${k}}}`, 'g'), v);
  }
  return str;
}

// === Set up Lowdb ===
const db = new Low(new JSONFile('db.json'));
async function initDB() {
  await db.read();
  db.data ||= { users: [], groups: [], history: [] };
  // Ensure all users have coins field
  for (const user of db.data.users) {
    if (user.coins === undefined) user.coins = 0;
  }
  await db.write();
}
initDB();

// === Load Commands ===
const commands = new Map();
const commandFiles = fs.readdirSync('./cmds').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./src/cmds/${file}`);
  commands.set(command.name, command);
  console.log(command.name);
}
let totalCommands = 0;
console.log(totalCommands);
// === Load Events ===
const events = new Map();
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
  const event = require(`./src/events/${file}`);
  if (event.event) events.set(event.event, event);
}
let event = 0;
// continue 

// === Facebook Login ===
login({ appState: JSON.parse(fs.readFileSync('appstate.json', 'utf8')) }, (err, api) => {
  if (err) return console.error(err);

  api.listenMqtt(async (err, message) => {
    if (err) return console.error(err);

    console.log('Logged in');
    console.log('Bot Name: settings.botName'); // add also prefix, and admins with name - id, the botvhas started listening for events
    // Check if message is from allowed group, if in group
    if (message.isGroup && settings.allowedGroups.length > 0 && !settings.allowedGroups.includes(message.threadID)) {
      return api.sendMessage(t('groupNotAllowed'), message.threadID);
    }

    // Ensure group data in DB
    if (message.isGroup) {
      await db.read();
      let group = db.data.groups.find(g => g.groupID === message.threadID);
      if (!group) {
        db.data.groups.push({
          groupID: message.threadID,
          name: message.threadName || '',
          joinedAt: Date.now(),
          admins: []
        });
        await db.write();
      }
    }

    // Ensure user coins in DB for sender
    if (message.senderID) {
      await db.read();
      let user = db.data.users.find(u => u.userID === message.senderID);
      if (!user) {
        db.data.users.push({ userID: message.senderID, name: '', coins: 0 });
        await db.write();
      } else if (user.coins === undefined) {
        user.coins = 0;
        await db.write();
      }
    }

    // Welcome message if first message in group
    if (message.body && message.body.toLowerCase() === settings.prefix + `start`) {
      return api.sendMessage(
        t('welcome', { botName: settings.botName, prefix: settings.prefix }),
        message.threadID
      );
    }

    // Always trigger the 'message' event
    if (events.has('message')) {
      try {
        await events.get('message').handler(api, message, db, settings, t);
      } catch (e) {
        console.error('[Event:message] Error:', e);
      }
    }

    // Command handling
    if (message.body && message.body.startsWith(settings.prefix)) {
      const args = message.body.slice(settings.prefix.length).trim().split(/ +/g);
      const commandName = args.shift().toLowerCase();
      const command = commands.get(commandName);

      if (!command) return;

      // Admin-only system example
      if (command.adminOnly && !settings.adminIDs.includes(message.senderID)) {
        // Check group admin
        if (message.isGroup) {
          await db.read();
          const group = db.data.groups.find(g => g.groupID === message.threadID);
          if (!(group && Array.isArray(group.admins) && group.admins.includes(message.senderID))) {
            return api.sendMessage(t('notAdmin'), message.threadID);
          }
        } else {
          return api.sendMessage(t('notAdmin'), message.threadID);
        }
      }

      try {
        await command.execute(api, message, args, db, settings, t);
        // Trigger event hooks for add/remove/update, etc
        if (events.has(commandName)) {
          await events.get(commandName).handler(api, message, args, db, settings, t);
        }
      } catch (e) {
        api.sendMessage('Error executing command.', message.threadID);
        console.error('[Command] Error:', e);
      }
    }
  });
});
