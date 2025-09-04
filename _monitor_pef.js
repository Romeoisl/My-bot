const fs = require('fs');
const http = require('http');
const https = require('https');

const {
  DEPLOYED_URL,
  HEARTBEAT_INTERVAL_MS = 1 * 60 * 1000, // 1 minute
  POLLING_INTERVAL_MS = 5 * 60 * 1000, // 5 minutes
  MAX_RETRIES = 3,
  LOG_FILE = 'monitlog.json',
} = process.env;

if (!DEPLOYED_URL) {
  console.error('DEPLOYED_URL is required');
  process.exit(1);
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: options.headers,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          data,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.data) {
      req.write(options.data);
    }

    req.end();
  });
}

async function sendHeartbeat(url) {
  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      const response = await request(url);
      if (response.status === 200) {
        console.log(`Heartbeat sent to ${url}`);
        saveLog(url, response, 'heartbeat');
        return;
      } else {
        console.error(`Error sending heartbeat to ${url}: ${response.statusText}`);
        saveLog(url, response, 'error');
      }
    } catch (error) {
      console.error(`Error sending heartbeat to ${url}: ${error.message}`);
      saveLog(url, { error: error.message }, 'error');
    }
    retries++;
    await new Promise((resolve) => setTimeout(resolve, 10000)); // wait 10 seconds before retrying
  }
  console.error(`Failed to send heartbeat to ${url} after ${MAX_RETRIES} retries`);
}

async function monitorUrl(url) {
  try {
    const response = await request(url);
    if (response.status === 200) {
      console.log(`URL ${url} is online`);
      saveLog(url, response, 'monitor');
    } else {
      console.error(`URL ${url} is offline: ${response.statusText}`);
      saveLog(url, response, 'error');
    }
  } catch (error) {
    console.error(`Error monitoring URL ${url}: ${error.message}`);
    saveLog(url, { error: error.message }, 'error');
  }
}

function saveLog(url, response, type) {
  const log = {
    url,
    type,
    timestamp: new Date().toISOString(),
    response,
  };

  try {
    if (fs.existsSync('monitor.json')) {
      fs.unlinkSync('monitor.json');
    }
  } catch (error) {
    console.error(`Error deleting older log: ${error.message}`);
  }

  fs.writeFileSync('monitor.json', JSON.stringify(log, null, 2));
}

async function main() {
  console.log(`Starting heartbeat monitor for ${DEPLOYED_URL}`);
  console.log(`Sending heartbeat every ${HEARTBEAT_INTERVAL_MS / 1000} seconds...`);
  console.log(`Monitoring URL every ${POLLING_INTERVAL_MS / 1000} seconds...`);

  let lastHeartbeat = Date.now();
  let lastMonitor = Date.now();

  while (true) {
    const currentTime = Date.now();

    if (currentTime - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
      await sendHeartbeat(DEPLOYED_URL);
      lastHeartbeat = currentTime;
    }

    if (currentTime - lastMonitor >= POLLING_INTERVAL_MS) {
      await monitorUrl(DEPLOYED_URL);
      lastMonitor = currentTime;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000)); // check every second
  }
}
module.exports = {
  start: main().catch((error) => console.error(`Main error: ${error.message}`));

};
