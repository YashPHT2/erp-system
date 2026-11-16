const mongoose = require('mongoose');
const { registerModel } = require('./shared');
const schema = new mongoose.Schema({
  admissionNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  className: { type: String, required: true, trim: true },
  section: { type: String, default: '', trim: true, uppercase: true },
  academicYear: { type: String, required: true },
}, { timestamps: true });
module.exports = registerModel('Student', schema);
