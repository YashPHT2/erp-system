const mongoose = require('mongoose');
const { registerModel } = require('./shared');
const schema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userVersion: { type: Number, required: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  revokedAt: { type: Date, default: null },
  createdByIp: String,
}, { timestamps: true });
module.exports = registerModel('RefreshToken', schema);
