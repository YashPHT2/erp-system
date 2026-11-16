const mongoose = require('mongoose');
const { registerModel } = require('./shared');
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  failures: { type: Number, default: 0 },
  windowStart: { type: Date, required: true },
  lockedUntil: { type: Date, default: null },
  version: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});
module.exports = registerModel('LoginAttempt', schema);
