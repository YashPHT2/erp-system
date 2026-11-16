const net = require('net');
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
require('./backend/node_modules/dotenv').config({ path: path.join(__dirname, 'backend/.env'), quiet: true });
const { MongoClient } = require('./backend/node_modules/mongodb');
const config = require('./backend/config/env');
config.assertRuntimeConfig();
const uri = config.mongoUri;
const children = [];
let mongo;
let mongoClient;
let shuttingDown = false;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function portOpen(port, host = '127.0.0.1') {
  return new Promise(resolve => {
    const socket = net.createConnection({ port, host });
    socket.setTimeout(1000);
    const done = value => { socket.destroy(); resolve(value); };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.once('timeout', () => done(false));
  });
}
function mongoBinary() {
  if (process.env.MONGOD_BINARY) {
    if (!fs.existsSync(process.env.MONGOD_BINARY)) throw new Error('MONGOD_BINARY does not exist.');
    return process.env.MONGOD_BINARY;
  }
  const found = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['mongod'], { encoding: 'utf8', windowsHide: true });
  if (found.status === 0) return found.stdout.trim().split(/\r?\n/)[0];
  // Reuse a downloaded mongod executable, without the memory-server runtime.
  const cache = path.join(__dirname, 'node_modules/.cache/mongodb-memory-server');
  if (fs.existsSync(cache)) {
    const file = fs.readdirSync(cache).find(name => /^mongod-/.test(name) && (process.platform !== 'win32' || name.endsWith('.exe')));
    if (file) return path.join(cache, file);
  }
  throw new Error('Install MongoDB Community Server and set MONGOD_BINARY, or configure MONGO_URI for your MongoDB replica set.');
}
function service(script, cwd, args = []) {
  const child = spawn(process.execPath, [script, ...args], { cwd, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.once('error', error => { console.error(error.message); shutdown(1); });
  child.once('exit', code => { if (!shuttingDown) shutdown(code || 0); });
  return child;
}
async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill();
  if (mongo && mongoClient) {
    try { await mongoClient.db('admin').command({ shutdown: 1 }); } catch (_) {}
  }
  if (mongoClient) await mongoClient.close().catch(() => {});
  if (mongo && mongo.exitCode === null) mongo.kill();
  process.exit(code);
}
async function main() {
  for (const port of [config.port, 5173]) if (await portOpen(port)) throw new Error(`Port ${port} is already in use. Stop the existing app before starting another instance.`);
  const parsed = new URL(uri);
  const local = ['127.0.0.1', 'localhost'].includes(parsed.hostname);
  const port = Number(parsed.port || 27017);
  if (local && !await portOpen(port)) {
    const data = path.join(__dirname, '.mongo-data');
    fs.mkdirSync(data, { recursive: true });
    const log = path.join(data, 'mongod.log');
    const replSet = parsed.searchParams.get('replicaSet') || 'rs0';
    console.log('Starting persistent MongoDB server.');
    mongo = spawn(mongoBinary(), ['--port', String(port), '--dbpath', data, '--replSet', replSet, '--bind_ip', '127.0.0.1', '--logpath', log, '--logappend'], { stdio: 'ignore', windowsHide: true });
    mongo.once('error', error => { console.error(error.message); shutdown(1); });
    for (let i = 0; i < 100; i++) {
      if (mongo.exitCode !== null) throw new Error(`MongoDB exited. Inspect ${log}`);
      if (await portOpen(port)) break;
      await pause(200);
    }
    mongoClient = new MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`, { serverSelectionTimeoutMS: 10000 });
    await mongoClient.connect();
    // Only configure the single-node server this launcher just started.
    // Its persisted replica-set member address may need updating after a port change.
    let previous;
    try { previous = (await mongoClient.db('admin').command({ replSetGetConfig: 1 })).config; }
    catch (error) { if (error.codeName !== 'NotYetInitialized') throw error; }
    const address = `127.0.0.1:${port}`;
    if (!previous) await mongoClient.db('admin').command({ replSetInitiate: { _id: replSet, members: [{ _id: 0, host: address }] } });
    else if (previous._id === replSet && previous.members.length === 1 && previous.members[0].host !== address) {
      previous.members[0].host = address;
      previous.version += 1;
      await mongoClient.db('admin').command({ replSetReconfig: previous, force: true });
    }
    for (let i = 0; i < 100; i++) {
      const state = await mongoClient.db('admin').command({ hello: 1 });
      if (state.isWritablePrimary) break;
      await pause(200);
    }
    console.log('MongoDB ready. Data is stored in .mongo-data.');
  }
  const check = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  try {
    await check.connect();
    const hello = await check.db('admin').command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('MongoDB must be configured as a replica set for transactions.');
  } finally { await check.close(); }
  service('server.js', path.join(__dirname, 'backend'));
  service(path.join(__dirname, 'frontend/node_modules/vite/bin/vite.js'), path.join(__dirname, 'frontend'));
  console.log('EduFinance: http://localhost:5173');
}
process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
main().catch(error => { console.error(error.message); shutdown(1); });
