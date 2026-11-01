const mongoose = require('mongoose');
const { registerModel } = require('./shared');

const refreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true },
  userEmail: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  revokedAt: { type: Date, sparse: true },
  replacedByToken: { type: String },
  createdByIp: { type: String },
}, { timestamps: true });

module.exports = registerModel('RefreshToken', refreshTokenSchema);
