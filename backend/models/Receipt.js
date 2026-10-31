const mongoose = require('mongoose');
const { actorSchema, registerModel } = require('./shared');

const receiptSchema = new mongoose.Schema({
  receiptNumber: { type: String, required: true, unique: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeePayment', required: true, unique: true },
  studentId: { type: String, required: true },
  admissionNumber: { type: String, required: true },
  studentName: { type: String, required: true },
  className: { type: String, required: true },
  section: { type: String, default: '' },
  academicYear: { type: String, required: true },
  amountPaise: { type: Number, required: true, min: 1 },
  paymentMode: { type: String, enum: ['cash', 'bank_transfer', 'cheque'], required: true },
  chequeNumber: { type: String, default: '' },
  referenceNumber: { type: String, default: '' },
  remarks: { type: String, default: '' },
  paymentDate: { type: Date, required: true },
  receivedBy: { type: actorSchema, required: true },
  remainingBalancePaise: { type: Number, required: true, min: 0 },
  advancePaise: { type: Number, required: true, min: 0, default: 0 },
  status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
  institutionName: { type: String, required: true },
  cancellation: {
    reason: { type: String, default: '' },
    cancelledBy: { type: actorSchema },
    cancelledAt: { type: Date },
    reversedAmountPaise: { type: Number, min: 0 },
  },
}, { timestamps: true });

receiptSchema.index({ admissionNumber: 1, paymentDate: -1 });
receiptSchema.index({ status: 1, paymentDate: -1 });

module.exports = registerModel('Receipt', receiptSchema);
