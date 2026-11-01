const mongoose = require('mongoose');
const { registerModel } = require('./shared');

const passwordResetTokenSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  usedAt: { type: Date },
}, { timestamps: true });

module.exports = registerModel('PasswordResetToken', passwordResetTokenSchema);
