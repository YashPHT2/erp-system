const { registerModel } = require('./shared');

const counterSchema = {
  _id: { type: String },
  seq: { type: Number, default: 0 },
};

const mongoose = require('mongoose');
const schema = new mongoose.Schema(counterSchema, { versionKey: false });

module.exports = registerModel('Counter', schema);
