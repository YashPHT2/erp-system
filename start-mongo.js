const net = require('net');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
    socket.connect(port, '127.0.0.1');
  });
}

async function main() {
  // 1. Start MongoDB (in-memory replica set)
  const mongoRunning = await isPortInUse(27017);
  let replSet = null;

  if (!mongoRunning) {
    console.log('[mongo] Starting in-memory MongoDB Replica Set...');
    const { MongoMemoryReplSet } = require('./backend/node_modules/mongodb-memory-server');
    const dbPath = path.resolve(__dirname, '.mongo-data');
    if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, name: 'rs0', storageEngine: 'wiredTiger', dbPath },
      instanceOpts: [{ port: 27017 }],
    });
    console.log('[mongo] MongoDB ready at', replSet.getUri('edufinance'));
  } else {
    console.log('[mongo] MongoDB already running on port 27017.');
  }

  // 2. Seed database
  try {
    console.log('[seed] Seeding database...');
    execSync('node seed/seed.js', {
      cwd: path.resolve(__dirname, 'backend'),
      stdio: 'inherit',
      timeout: 60000,
    });
    console.log('[seed] Done.');
  } catch (e) {
    console.warn('[seed] Seed skipped (already seeded or failed):', e.message.split('\n')[0]);
  }

  // 3. Start backend API
  console.log('[api] Starting backend on port 5050...');
  const api = spawn('node', ['server.js'], {
    cwd: path.resolve(__dirname, 'backend'),
    stdio: 'inherit',
    shell: false,
  });

  // 4. Start Vite frontend via npx (works on Windows)
  console.log('[web] Starting frontend on port 5173...');
  const web = spawn('npx', ['vite', '--host'], {
    cwd: path.resolve(__dirname, 'frontend'),
    stdio: 'inherit',
    shell: true,
  });

  console.log('\n====================================');
  console.log('  App: http://localhost:5173');
  console.log('  API: http://localhost:5050');
  console.log('');
  console.log('  Login credentials:');
  console.log('  accountant@edufinance.local');
  console.log('  Password: EduFinance#Dev2026');
  console.log('====================================\n');

  const cleanup = async () => {
    api.kill();
    web.kill();
    if (replSet) await replSet.stop();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((err) => {
  console.error('Startup failed:', err.message);
  process.exit(1);
});
