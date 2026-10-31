const mongoose = require('mongoose');

const actorSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
}, { _id: false });

const moneyComponentSchema = new mongoose.Schema({
  code: { type: String, required: true },
  label: { type: String, required: true },
  amountPaise: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Amount must be a whole number of paise.',
    },
  },
}, { _id: false });

function registerModel(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema);
}

module.exports = { actorSchema, moneyComponentSchema, registerModel };
