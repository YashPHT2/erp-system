require('dotenv').config();
const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5050),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/edufinance_live?replicaSet=rs0',
  jwtSecret: process.env.JWT_SECRET || '',
  institutionName: process.env.INSTITUTION_NAME || 'EduFinance',
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  transactionsEnabled: false,
  get setupToken() { return process.env.SETUP_TOKEN || ''; },
  get studentProvider() { return process.env.STUDENT_PROVIDER || 'mongo'; },
  get employeeProvider() { return process.env.EMPLOYEE_PROVIDER || 'mongo'; },
  get studentApiBaseUrl() { return process.env.STUDENT_API_BASE_URL || ''; },
  get employeeApiBaseUrl() { return process.env.EMPLOYEE_API_BASE_URL || ''; },
  isOverpaymentAllowed() { return process.env.ALLOW_OVERPAYMENT === 'true'; },
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  refreshTokenExpiryDays: Number(process.env.REFRESH_TOKEN_EXPIRY_DAYS || 7),
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || '',
};
function assertRuntimeConfig() {
  if (process.env.DEMO_MODE === 'true' && (config.nodeEnv === 'production' || new URL(config.mongoUri).pathname !== '/edufinance_demo')) throw new Error('Demo mode requires the separate edufinance_demo database and cannot run in production.');
  if (config.jwtSecret.length < 32 || config.jwtSecret.includes('replace-with')) throw new Error('JWT_SECRET must be a random secret of at least 32 characters.');
  for (const kind of ['student', 'employee']) {
    if (!['mongo', 'http'].includes(config[`${kind}Provider`])) throw new Error(`${kind.toUpperCase()}_PROVIDER must be mongo or http. Mock providers are not supported.`);
    if (config[`${kind}Provider`] === 'http' && !/^https?:\/\//.test(config[`${kind}ApiBaseUrl`])) throw new Error(`${kind.toUpperCase()}_API_BASE_URL is required for the HTTP provider.`);
  }
  if (!Number.isInteger(config.refreshTokenExpiryDays) || config.refreshTokenExpiryDays < 1 || config.refreshTokenExpiryDays > 90) throw new Error('REFRESH_TOKEN_EXPIRY_DAYS must be between 1 and 90.');
  if (config.nodeEnv === 'production' && !config.clientOrigin.startsWith('https://')) throw new Error('CLIENT_ORIGIN must use HTTPS in production.');
}
module.exports = config;
module.exports.assertRuntimeConfig = assertRuntimeConfig;
