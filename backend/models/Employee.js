const mongoose = require('mongoose');
const { registerModel } = require('./shared');
const schema = new mongoose.Schema({
  employeeCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  designation: { type: String, required: true, trim: true },
  department: { type: String, required: true, trim: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });
module.exports = registerModel('Employee', schema);
