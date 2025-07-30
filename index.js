const { spawn } = require('child_process');
const fs = require('fs');
const settings = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
const interval = (settings.restartIntervalMinutes || 60) * 60 * 1000; // Default: 60min
let botProcess; // Store the child process reference
function startBot() {
  // Ensure no previous process is running  
  if (botProcess) {
    botProcess.kill('SIGTERM'); // Kill the previous process  
    botProcess = null; // Clear reference 
  }  // Spawn a new child process for the bot 
  botProcess = spawn('node', ['titan.js'], { stdio: 'inherit' });  // Handle bot process exit 
  botProcess.on('exit', (code) => {
    console.log(`[AutoRestart] Bot exited with code ${code}. Restarting...`); 
    process.exit(code); // 
  });
}// Schedule bot restarts
setInterval(() => { 
  console.log('[AutoRestart] Restarting bot...');  
  startBot(); // Restart the bo
}, interval);// Initial bot start

startBot();
