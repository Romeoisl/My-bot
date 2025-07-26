# Titan Botz

![Titan Botz Logo](https://your-logo-url-here.gif)

**Titan Botz** is a modular and customizable Facebook Messenger chatbot.  
It supports group management, event handling, command execution, and can be easily extended with new features.  
Designed to be user-friendly for both admins and developers.

## Credits
- Developed by **Team Titan**
- Special thanks to contributors and the open source community
  
## How to Use

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/titan-botz.git
   cd titan-botz
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Settings**
   - Edit `settings.json` to set your bot's name, admins, allowed groups, and Facebook bot ID.
   - Place your language files in `languages/`.

4. **Obtain AppState**
   - Use c3c UFC from chrome extension or kiwi exentions
   - Place `appstate.json` in the root directory.

5. **Start the Bot**
   ```bash
   node index.js
   ```

## Hosting (Render & More)

### Render.com
- Create a new Node.js web service.
- Add your environment variables and upload your code.
- Make sure your `appstate.json` and `settings.json` are included (use Render's Secrets for sensitive data).

### Other Platforms
- **Glitch:** Import the repo, add secrets, and start the service.
- **Railway:** Use a Node.js template, upload your files, and run.
- **Heroku:** Deploy as a Node.js app (be aware of sleep policies).

## Adding More Commands or Events

- **Commands:**  
  Add `.js` files in `src/cmds/` following the command structure.

- **Events:**  
  Add `.js` files in `src/events/` with the correct `eventType` and `run` function signature.

## License

MIT License.  
See [LICENSE](LICENSE) for details.

---

*For support or contributions, open an issue or pull request!*
