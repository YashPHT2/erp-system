const mongoose = require('mongoose');
const { ROLES } = require('../constants');
const { registerModel } = require('./shared');

const devUserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true },
  role: { type: String, enum: ROLES, required: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true });

const systemMetaSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  demoSeed: { type: Boolean, default: false },
  seededAt: { type: Date },
}, { timestamps: true });

module.exports = {
  DevUser: registerModel('DevUser', devUserSchema),
  SystemMeta: registerModel('SystemMeta', systemMetaSchema),
};
