const mongoose = require('mongoose');
const { registerModel } = require('./shared');

const feeAccountSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  admissionNumber: { type: String, required: true },
  studentName: { type: String, required: true },
  className: { type: String, required: true },
  section: { type: String, default: '' },
  academicYear: { type: String, required: true },
  feeStructureId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeStructure', required: true },
  totalAmountPaise: { type: Number, required: true, min: 0 },
  paidAmountPaise: { type: Number, required: true, min: 0, default: 0 },
  pendingAmountPaise: { type: Number, required: true, min: 0, default: 0 },
  advancePaise: { type: Number, required: true, min: 0, default: 0 },
  version: { type: Number, required: true, default: 0 },
}, {
  timestamps: true,
  versionKey: false,
});

feeAccountSchema.index({ admissionNumber: 1, academicYear: 1 }, { unique: true });

module.exports = registerModel('FeeAccount', feeAccountSchema);
