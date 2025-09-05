const fs = require("fs")
const path = require("path")
const { login } = require("nexus-fca")
const settings = JSON.parse(fs.readFileSync(path.join(__dirname, "settings.json"), "utf8"))
const figlet = require("figlet")
const { MongoClient } = require("mongodb")

// === MongoDB Configuration ===
const MONGODB_URI = settings.mongodb_url || "mongodb+srv://mateochatbot:xdtL2bYQ9eV3CeXM@gerald.r2hjy.mongodb.net/titanbot?retryWrites=true&w=majority&appName=Cluster0"
let db
let usersCollection
let groupsCollection
let historyCollection

// === MongoDB Connection ===
async function connectMongoDB() {
  try {
    const client = new MongoClient(MONGODB_URI)
    await client.connect()
    db = client.db()
    usersCollection = db.collection("users")
    groupsCollection = db.collection("groups")
    historyCollection = db.collection("history")

    // Create indexes for better performance
    await usersCollection.createIndex({ userID: 1 }, { unique: true })
    await groupsCollection.createIndex({ groupID: 1 }, { unique: true })

    console.log("✅ Connected to MongoDB successfully")
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error)
    process.exit(1)
  }
}

// === Database Helper Functions ===
async function getUser(userID) {
  return await usersCollection.findOne({ userID })
}

async function createUser(userData) {
  const defaultUser = {
    userID: userData.userID,
    name: userData.name || "",
    coins: 0,
    createdAt: new Date(),
    ...userData,
  }

  try {
    await usersCollection.insertOne(defaultUser)
    return defaultUser
  } catch (error) {
    if (error.code === 11000) {
      // User already exists, return existing user
      return await getUser(userData.userID)
    }
    throw error
  }
}

async function updateUser(userID, updateData) {
  return await usersCollection.updateOne({ userID }, { $set: { ...updateData, updatedAt: new Date() } })
}

async function getGroup(groupID) {
  return await groupsCollection.findOne({ groupID })
}

async function createGroup(groupData) {
  const defaultGroup = {
    groupID: groupData.groupID,
    name: groupData.name || "",
    joinedAt: new Date(),
    admins: [],
    ...groupData,
  }

  try {
    await groupsCollection.insertOne(defaultGroup)
    return defaultGroup
  } catch (error) {
    if (error.code === 11000) {
      // Group already exists, return existing group
      return await getGroup(groupData.groupID)
    }
    throw error
  }
}

async function updateGroup(groupID, updateData) {
  return await groupsCollection.updateOne({ groupID }, { $set: { ...updateData, updatedAt: new Date() } })
}

async function addToHistory(historyData) {
  return await historyCollection.insertOne({
    ...historyData,
    createdAt: new Date(),
  })
}

// === Bot Banner & Info ===
function printBanner() {
  return new Promise((resolve, reject) => {
    figlet("Titan Botz", (err, data) => {
      if (err) {
        console.log("Error generating banner")
        return reject(err)
      } else {
        console.log(data)
        console.log("Titan Botz - v1.0.0\nThis bot is made by Team Titan")
        resolve()
      }
    }) 
  })
}

(async () => {
  await printBanner()

  // === Connect to MongoDB ===
  await connectMongoDB()

  // === Language Loader ===
  function loadLang(lang) {
    const langPath = path.join(__dirname, "languages", `${lang}.json`)
    if (fs.existsSync(langPath)) {
      return JSON.parse(fs.readFileSync(langPath, "utf8"))
    }
    return JSON.parse(fs.readFileSync(path.join(__dirname, "languages", `en.json`), "utf8"))
  }

  const lang = loadLang(settings.language)

  // === Language String Formatter ===
  function getText(key, replacements = {}) {
    let str = lang[key] || key
    for (const [k, v] of Object.entries(replacements)) {
      str = str.replace(new RegExp(`{{${k}}}`, "g"), v)
    }
    return str
  }

  // === Load Commands ===
  const commands = new Map()
  const cmdDir = path.join(__dirname, "src", "cmds")

  if (fs.existsSync(cmdDir)) {
    const commandFiles = fs.readdirSync(cmdDir).filter((file) => file.endsWith(".js"))
    for (const file of commandFiles) {
      const command = require(path.join(cmdDir, file))
      commands.set(command.name, command)
    }
    console.log("Total commands loaded:", commands.size)
  } else {
    console.warn("[Warning] Commands directory not found. Skipping command loading.")
  }

  // === Check and Load appstate.json ===
  const creds = {
    appState: JSON.parse(fs.readFileSync("appstate.json", "utf8")),
  }

  // === New Event Handler ===
  async function eventsHandler(api, event) {
    const eventsPath = path.join(__dirname, "..", "src", "events")
    if (!fs.existsSync(eventsPath)) return

    const eventFiles = fs.readdirSync(eventsPath)
    for (const file of eventFiles) {
      if (file.endsWith(".js")) {
        const eventFunction = await require(path.join(eventsPath, file))
        if (eventFunction.default && eventFunction.default.eventType === event.logMessageType) {
          await eventFunction.default.run(api, event)
        }
      }
    }
  }

  // === Facebook Login ===
  login(
    creds,
    {
      online: settings.fcaOptions.online,
      updatePresence: settings.fcaOptions.updatePresence,
      selfListen: settings.fcaOptions.selfListen,
      randomUserAgent: false,
    },
    (err, api) => {
      if (err) return console.error("[Error] Facebook Login Failed:", err)
      (async () => {
        const admins = []
        for (const id of settings.adminIDs) {
          const user = await getUser(id)
          admins.push(user ? `${user.name} (${id})` : id)
        }

        console.log(`Bot Name: ${settings.botName}`)
        console.log(`Prefix: ${settings.prefix}`)
        console.log(`Admins: ${admins.join(", ")}`)
        console.log("The bot has started listening for events...")
      })()

      const onReplyMap = new Map()
      const onChatMap = new Map()
      const onBootCallbacks = []

      process.on("SIGINT", async () => {
        for (const callback of onBootCallbacks) {
          try {
            await callback("shutdown")
          } catch (e) {
            console.error("[onBoot] Error:", e)
          }
        }
        process.exit(0)
      })

      process.on("SIGTERM", async () => {
        for (const callback of onBootCallbacks) {
          try {
            await callback("shutdown")
          } catch (e) {
            console.error("[onBoot] Error:", e)
          }
        }
        process.exit(0)
      })

      api.listenMqtt(async (err, event) => {
        if (err) return console.error("[Error] Failed to listen for events:", err)

        const message = event

        await eventsHandler(api, message)

        if (
          message.isGroup &&
          settings.allowedGroups.length > 0 &&
          !settings.allowedGroups.includes(message.threadID)
        ) {
          return api.sendMessage(getText("groupNotAllowed"), message.threadID)
        }

        // === Handle Group Data ===
        if (message.isGroup) {
          const group = await getGroup(message.threadID)
          if (!group) {
            await createGroup({
              groupID: message.threadID,
              name: message.threadName || "",
              joinedAt: new Date(),
              admins: [],
            })
          }
        }

        // === Handle User Data ===
        if (message.senderID) {
          const user = await getUser(message.senderID)
          if (!user) {
            await createUser({
              userID: message.senderID,
              name: "",
              coins: 0,
            })
          } else if (user.coins === undefined) {
            await updateUser(message.senderID, { coins: 0 })
          }
        }

        // === Handle Reply Events ===
        if (onReplyMap.has(message.threadID)) {
          const onReply = onReplyMap.get(message.threadID)
          if (onReply.type === "continue") {
            try {
              const command = commands.get(onReply.name)
              if (command) {
                await command.execute(
                  api,
                  message,
                  [],
                  { getUser, createUser, updateUser, getGroup, createGroup, updateGroup, addToHistory },
                  settings,
                  getText,
                  () => {},
                  onReply.callback,
                  (callback) => {
                    onBootCallbacks.push(callback)
                  },
                )
              }
            } catch (e) {
              api.sendMessage("Error executing command.", message.threadID)
              console.error("[Command] Error:", e)
            }
            return
          }
        }

        // === Handle Commands Without Prefix ===
        if (message.body && !message.body.startsWith(settings.prefix)) {
          for (const [name, command] of commands) {
            if (command.executeWithoutPrefix && typeof command.execute === "function") {
              try {
                await command.execute(
                  api,
                  message,
                  [],
                  { getUser, createUser, updateUser, getGroup, createGroup, updateGroup, addToHistory },
                  settings,
                  getText,
                  () => {},
                  null,
                  (callback) => {
                    onBootCallbacks.push(callback)
                  },
                )
              } catch (e) {
                api.sendMessage("Error executing command.", message.threadID)
                console.error("[Command] Error:", e)
              }
            }
          }
        }

        // === Handle Commands With Prefix ===
        if (message.body && message.body.startsWith(settings.prefix)) {
          const args = message.body.slice(settings.prefix.length).trim().split(/ +/g)
          const commandName = args.shift().toLowerCase()
          const command = commands.get(commandName)

          if (!command) return api.sendMessage("The command you are using does not exist.", message.threadID)

          try {
            let role
            if (settings.ownerID === message.senderID) role = 3
            else if (settings.adminIDs.includes(message.senderID)) role = 2
            else if (message.isGroup && message.participantIDs.includes(message.senderID)) role = 1
            else role = 0

            if (command.role > role) return api.sendMessage(getText("notAuthorized"), message.threadID)

            const onReply = (onReplyData) => {
              onReplyMap.set(message.threadID, onReplyData)
            }

            const onChat = (onChatData) => {
              // Placeholder for chat event handling
            }

            const onBoot = (callback) => {
              onBootCallbacks.push(callback)
            }

            await command.execute(
              api,
              message,
              args,
              { getUser, createUser, updateUser, getGroup, createGroup, updateGroup, addToHistory },
              settings,
              getText,
              onChat,
              onReply,
              onBoot,
            )
          } catch (e) {
            api.sendMessage("Error executing command.", message.threadID)
            console.error("[Command] Error:", e)
          }
        }
      })
    },
  )
})()
