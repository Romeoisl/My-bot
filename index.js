
const { spawn } = require('child_process');
const fs = require('fs');

const settings = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
const interval = (settings.restartIntervalMinutes || 60) * 60 * 1000; // Default: 60min

function startBot() {
  const child = spawn('node', ['index.js'], { stdio: 'inherit' });

  // On bot exit, kill parent so restart.js restarts everything
  child.on('exit', code => {
    process.exit(code);
  });

  // Schedule restart
  setTimeout(() => {
    console.log('[AutoRestart] Restarting bot...');
    child.kill('SIGTERM');
  }, interval);
}

startBot();
