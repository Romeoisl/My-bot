const { login } = require('ws3-fca');
const fs = require('fs');
const path = require('path'); the
const figlet = require('figlet');
const { Low, JSONFile } = require('lowdb');

// === Load Settings ===
const settings = JSON.parse(fs.readFileSync(path.join(__dirname, 'settings.json'), 'utf8'));

// === Bot Banner & Info ===
figlet('Titan Botz', (err, data) => {
  if (err) {
    console.log('Error generating banner');
  } else {
    console.log(data);
    console.log('Titan Botz - v1.0.0\nThis bot is made by Team Titan');
  }
});

// === Language Loader ===
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
function getText(key, replacements = {}) {
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
  for (const user of db.data.users) {
    if (user.coins === undefined) user.coins = 0;
  }
  await db.write();
}
initDB();

// === Load Commands ===
const commands = new Map();
const cmdDir = path.join(__dirname, 'src', 'cmds');
if (fs.existsSync(cmdDir)) {
  const commandFiles = fs.readdirSync(cmdDir).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(path.join(cmdDir, file));
    commands.set(command.name, command);
  }
  console.log('Total commands loaded:', commands.size);
} else {
  console.warn('[Warning] Commands directory not found. Skipping command loading.');
}

// === Check and Load appstate.json ===
const creds = { appState: JSON.parse(fs.readFileSync('appstate.json', 'utf8')) };
if (!appState || appState.length === 0) {
  console.error('[Error] appstate.json is missing or empty. Please generate a new AppState.');
  process.exit(1);
}

// === New Event Handler ===
async function eventsHandler(api, event) {
  const eventsPath = path.join(__dirname, '..', 'src', 'events');
  const eventFiles = fs.readdirSync(eventsPath);

  for (const file of eventFiles) {
    if (file.endsWith('.js')) {
      const eventFunction = await require(path.join(eventsPath, file));
      if (eventFunction.default.eventType === event.logMessageType) {
        await eventFunction.default.run(api, event);
      }
    }
  }
}

// === Facebook Login ===
login(creds, {
  online: settings.fcaOptions.online,
  updatePresence: settings.fcaOptions.updatePresence,
  selfListen: settings.fcaOptions.selfListen,
  randomUserAgent: false,
}, (err, api) => {
  if (err) return console.error('[Error] Facebook Login Failed:', err);

  // Print bot info when logged in
  (async () => {
    await db.read();
    const admins = settings.adminIDs.map(id => {
      const user = db.data.users.find(u => u.userID === id);
      return user ? `${user.name} (${id})` : id;
    });
    console.log(`Bot Name: ${settings.botName}`);
    console.log(`Prefix: ${settings.prefix}`);
    console.log(`Admins: ${admins.join(', ')}`);
    console.log('The bot has started listening for events...');
  })();

  // === Bot Event Listener ===
  api.listenMqtt(async (err, message) => {
    if (err) return console.error('[Error] Failed to listen for events:', err);

    // Invoke new event handler for every event
    await eventsHandler(api, message);

    // Check if message is from allowed group
    if (message.isGroup && settings.allowedGroups.length > 0 && !settings.allowedGroups.includes(message.threadID)) {
      return api.sendMessage(getText('groupNotAllowed'), message.threadID);
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

    // Command handling
    if (message.body && message.body.startsWith(settings.prefix)) {
      const args = message.body.slice(settings.prefix.length).trim().split(/ +/g);
      const commandName = args.shift().toLowerCase();
      const command = commands.get(commandName);

      if (!command) return api.sendMessage('The command you are using does not exist', message.threadID);

      try {
        if (command.adminOnly && !settings.adminIDs.includes(message.senderID)) {
          return api.sendMessage(getText('notAdmin'), message.threadID);
        }
        await command.execute(api, message, args, db, settings, getText);
      } catch (e) {
        api.sendMessage('Error executing command.', message.threadID);
        console.error('[Command] Error:', e);
      }
    }
  });
});
