const mongoose = require('mongoose');
const { registerModel } = require('./shared');
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});
module.exports = registerModel('RateLimit', schema);
