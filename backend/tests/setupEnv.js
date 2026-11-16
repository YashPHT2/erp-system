const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DEMO_MODE = 'false';
process.env.JWT_SECRET = 'test-jwt-secret-value-at-least-thirty-two-characters';
process.env.SETUP_TOKEN = 'test-setup-key-at-least-thirty-two-characters';
process.env.INSTITUTION_NAME = 'Northbridge Educational Institute';
process.env.APP_TIMEZONE = 'Asia/Kolkata';
process.env.ALLOW_OVERPAYMENT = 'false';
process.env.STUDENT_PROVIDER = 'mongo';
process.env.EMPLOYEE_PROVIDER = 'mongo';
process.env.SMTP_HOST = '';
process.env.SMTP_FROM = '';

const uriFile = path.join(__dirname, '.mongo-uri');
if (fs.existsSync(uriFile)) {
  process.env.MONGO_URI = fs.readFileSync(uriFile, 'utf8').trim();
}
