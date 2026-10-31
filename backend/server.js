const { createApp } = require('./app');
const { connectDb } = require('./config/db');
const config = require('./config/env');
const { assertRuntimeConfig } = require('./config/env');
const { refreshTransactionSupport } = require('./utils/transaction');

async function start() {
  assertRuntimeConfig();
  await connectDb();
  const transactions = await refreshTransactionSupport();
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`EduFinance API listening on port ${config.port}`);
    console.log(`Auth mode: ${config.authMode}`);
    console.log(`MongoDB transactions: ${transactions ? 'enabled' : 'unavailable'}`);
  });
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
