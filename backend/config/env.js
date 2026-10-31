require('dotenv').config();

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5050),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/edufinance',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtPublicKey: (process.env.JWT_PUBLIC_KEY || '').replace(/\\n/g, '\n'),
  institutionName: process.env.INSTITUTION_NAME || 'Northbridge Educational Institute',
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  transactionsEnabled: false,
  get authMode() {
    return process.env.AUTH_MODE || 'mock';
  },
  get studentProvider() {
    return process.env.STUDENT_PROVIDER || 'mock';
  },
  get employeeProvider() {
    return process.env.EMPLOYEE_PROVIDER || 'mock';
  },
  get studentApiBaseUrl() {
    return process.env.STUDENT_API_BASE_URL || '';
  },
  get employeeApiBaseUrl() {
    return process.env.EMPLOYEE_API_BASE_URL || '';
  },
  isOverpaymentAllowed() {
    return process.env.ALLOW_OVERPAYMENT === 'true';
  },
};

function assertRuntimeConfig() {
  if (!config.jwtSecret || config.jwtSecret.length < 16) {
    throw new Error('JWT_SECRET must be set and at least 16 characters.');
  }
  if (!['mock', 'jwt'].includes(config.authMode)) {
    throw new Error('AUTH_MODE must be either mock or jwt.');
  }
  if (config.nodeEnv === 'production' && config.authMode === 'mock') {
    throw new Error('AUTH_MODE=mock cannot be used when NODE_ENV=production.');
  }
}

module.exports = config;
module.exports.assertRuntimeConfig = assertRuntimeConfig;
