const mongoose = require('mongoose');
const { registerModel } = require('./shared');
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  version: { type: Number, default: 0 },
}, { timestamps: true });
module.exports = { SystemMeta: registerModel('SystemMeta', schema) };
