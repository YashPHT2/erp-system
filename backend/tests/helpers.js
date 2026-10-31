const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { refreshTransactionSupport } = require('../utils/transaction');

function signToken(overrides = {}) {
  return jwt.sign({
    sub: overrides.sub || 'user-1',
    name: overrides.name || 'Test User',
    email: overrides.email || 'test@edufinance.local',
    role: overrides.role || 'ACCOUNTANT',
  }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

function auth(role, extra) {
  return { Authorization: `Bearer ${signToken({ role, ...extra })}` };
}

async function connectTestDb() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
  await refreshTransactionSupport();
}

async function clearTestDb() {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

module.exports = { signToken, auth, connectTestDb, clearTestDb };
