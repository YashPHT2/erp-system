const { createApp } = require('./app');
const { connectDb } = require('./config/db');
const config = require('./config/env');
const { assertRuntimeConfig } = require('./config/env');
const { refreshTransactionSupport } = require('./utils/transaction');

async function start() {
  assertRuntimeConfig();
  await connectDb();
  const transactions = await refreshTransactionSupport();
  if (!transactions) throw new Error('MongoDB must be a replica set: transactions are required for finance and authentication.');
  const User = require('./models/User');
  require('./models/Student');
  require('./models/Employee');
  require('./models/RefreshToken');
  require('./models/PasswordResetToken');
  require('./models/RateLimit');
  await Promise.all(Object.values(require('mongoose').models).map(model => model.init()));
  if (!await User.exists({}) && config.setupToken.length < 32) throw new Error('Configure SETUP_TOKEN before creating the first administrator. Run npm run configure.');
  const app = createApp();
  const server = app.listen(config.port, process.env.API_HOST || '127.0.0.1', () => {
    console.log(`EduFinance API listening on port ${config.port}`);
    console.log('Authentication: database accounts and JWT sessions');
    console.log(`MongoDB transactions: ${transactions ? 'enabled' : 'unavailable'}`);
  });
  const stop = () => server.close(async () => { await require('mongoose').disconnect(); process.exit(0); });
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${config.port} is already in use. Stop the other EduFinance process, then run npm run dev again.`);
      process.exit(1);
    }
    console.error(error.message);
    process.exit(1);
  });
}

start().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
