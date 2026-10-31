const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/env');
const { assertRuntimeConfig } = require('./config/env');
const { sanitizeBody } = require('./middleware/sanitize');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { buildRouter } = require('./modules/routes');

function createApp() {
  assertRuntimeConfig();
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(sanitizeBody);
  app.use('/api/v1', buildRouter());
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
