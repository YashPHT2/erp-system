const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-value';
process.env.AUTH_MODE = 'mock';
process.env.INSTITUTION_NAME = 'Northbridge Educational Institute';
process.env.APP_TIMEZONE = 'Asia/Kolkata';
process.env.ALLOW_OVERPAYMENT = 'false';
process.env.STUDENT_PROVIDER = 'mock';
process.env.EMPLOYEE_PROVIDER = 'mock';
process.env.DEV_USER_PASSWORD = 'test-password';

const uriFile = path.join(__dirname, '.mongo-uri');
if (fs.existsSync(uriFile)) {
  process.env.MONGO_URI = fs.readFileSync(uriFile, 'utf8').trim();
}
