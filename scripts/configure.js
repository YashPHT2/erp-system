const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const file = path.join(__dirname, '../backend/.env');
if (!fs.existsSync(file)) {
  const template = fs.readFileSync(path.join(__dirname, '../backend/.env.example'), 'utf8');
  fs.writeFileSync(file, template.replace('GENERATE_JWT_SECRET', crypto.randomBytes(48).toString('hex')).replace('GENERATE_SETUP_TOKEN', crypto.randomBytes(32).toString('hex')), { mode: 0o600 });
  console.log('Created backend/.env with random secrets.');
} else {
  console.log('backend/.env already exists; configuration preserved.');
}
require('../backend/node_modules/dotenv').config({ path: file, quiet: true });
console.log('Create your first administrator at:');
console.log(`${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/setup#key=${process.env.SETUP_TOKEN || ''}`);
console.log('This setup key works only while the database has no accounts.');
