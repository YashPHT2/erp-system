const mongoose = require('mongoose');
const { ROLES } = require('../constants');
const { registerModel } = require('./shared');

const schema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  role: { type: String, enum: ROLES, required: true },
  passwordHash: { type: String, required: true, select: false },
  active: { type: Boolean, default: true },
  tokenVersion: { type: Number, default: 0 },
  studentAdmissionNumber: { type: String, default: '', trim: true, uppercase: true },
}, { timestamps: true });

schema.index({ studentAdmissionNumber: 1 }, { unique: true, partialFilterExpression: { role: 'STUDENT', studentAdmissionNumber: { $gt: '' } } });
module.exports = registerModel('User', schema);
