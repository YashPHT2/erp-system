const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { refreshTransactionSupport } = require('../utils/transaction');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const Student = require('../models/Student');
const Employee = require('../models/Employee');
const { ROLES } = require('../constants');
const { getStudents, EMPLOYEES } = require('./fixtures/directory');
const PASSWORD = 'Test-password-2026';
const passwordHash = bcrypt.hashSync(PASSWORD, 10);
const userId = role => `10000000000000000000000${ROLES.indexOf(role)}`;
const sessionId = role => `20000000000000000000000${ROLES.indexOf(role)}`;
const names = { SUPER_ADMIN: 'Administrator', PRINCIPAL: 'Priya Banerjee', ACCOUNTANT: 'Vikram Joshi', FEE_CLERK: 'Lavanya Rao', TEACHER: 'Meera Iyer', STUDENT: 'Aarav Sharma', LIBRARIAN: 'Sneha Patil' };
function signToken(overrides = {}) {
  const role = overrides.role || 'ACCOUNTANT';
  return jwt.sign({ sub: overrides.sub || userId(role), sid: sessionId(role), ver: 0, ...overrides }, process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h', issuer: 'edufinance', audience: 'edufinance-web' });
}
function auth(role, extra) { return { Authorization: `Bearer ${signToken({ role, ...extra })}` }; }
async function connectTestDb() {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGO_URI);
  await refreshTransactionSupport();
  // Build production indexes in the isolated test database too.
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
}
async function clearTestDb() {
  await Promise.all(Object.values(mongoose.connection.collections).map(collection => collection.deleteMany({})));
  await User.insertMany(ROLES.map(role => ({ _id: userId(role), email: `${role.toLowerCase()}@test.edu`, name: names[role], role, passwordHash, studentAdmissionNumber: role === 'STUDENT' ? 'ADM2026001' : '' })));
  await RefreshToken.insertMany(ROLES.map(role => ({ _id: sessionId(role), userId: userId(role), userVersion: 0,
    token: crypto.randomBytes(32).toString('hex'), expiresAt: new Date(Date.now()+3600000) })));
  await Student.insertMany(getStudents().map(({id,...student}, i) => ({ _id: String(3000+i).padStart(24,'0'), ...student })));
  await Employee.insertMany(EMPLOYEES.map(({id,...employee}, i) => ({ _id: String(1001+i).padStart(24,'0'), ...employee })));
}
module.exports = { signToken, auth, connectTestDb, clearTestDb, userId, PASSWORD };
