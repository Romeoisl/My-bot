const { bold } = require("fontstyles");

module.exports = {
  name: "help",
  description: "Displays a list of available commands",
  role: 0,
  category: "general",
  execute: async (api, message, args, db, settings, getText) => {
    // You must access global.commands here!
    const commands = global.commands || new Map();

    const categories = {};
    let totalCommands = 0;

    // Organize commands by category with role-based filtering
    for (const [name, command] of commands) {
      const canShow =
        command.role <= 0 ||
        (command.role === 1 && message.isGroup) ||
        (command.role === 2 && settings.adminIDs.includes(message.senderID)) ||
        (command.role === 3 && settings.ownerID === message.senderID);

      if (canShow) {
        const cat = command.category || "Uncategorized";
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(name);
        totalCommands++;
      }
    }

    // Build the help message
    let helpMessage = `${bold("TEAM TITAN-BOTZ")}\n`;
    helpMessage += `${bold(`Total Commands: ${totalCommands}`)}\n\n`;

    for (const category in categories) {
      helpMessage += `${bold(category.toUpperCase())}\n`;

      // Group commands in threes
      const commandsList = categories[category];
      for (let i = 0; i < commandsList.length; i += 3) {
        const group = commandsList.slice(i, i + 3);
        helpMessage += `• ${group.map(cmd => `${settings.prefix}${cmd}`).join(", ")}\n`;
      }
      helpMessage += "\n";
    }

    // Add footer
    helpMessage += `Use ${settings.prefix}help <command> for more info about a specific command.`;

    api.sendMessage(helpMessage, message.threadID);
  },
};
