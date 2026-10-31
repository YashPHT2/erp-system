const mongoose = require('mongoose');
const { actorSchema, registerModel } = require('./shared');

const feePaymentSchema = new mongoose.Schema({
  idempotencyKey: { type: String, required: true, unique: true },
  studentId: { type: String, required: true },
  admissionNumber: { type: String, required: true },
  studentName: { type: String, required: true },
  className: { type: String, required: true },
  section: { type: String, default: '' },
  academicYear: { type: String, required: true },
  feeStructureId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeStructure', required: true },
  feeAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeAccount', required: true },
  amountPaise: { type: Number, required: true, min: 1 },
  paymentMode: { type: String, enum: ['cash', 'bank_transfer', 'cheque'], required: true },
  chequeNumber: { type: String, default: '' },
  referenceNumber: { type: String, default: '' },
  remarks: { type: String, default: '' },
  paymentDate: { type: Date, required: true },
  receivedBy: { type: actorSchema, required: true },
  status: { type: String, enum: ['completed', 'cancelled'], default: 'completed' },
  receiptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt' },
  receiptNumber: { type: String, default: '' },
  totalFeePaise: { type: Number, required: true, min: 0 },
  paidBeforePaise: { type: Number, required: true, min: 0 },
  pendingBeforePaise: { type: Number, required: true, min: 0 },
  pendingAfterPaise: { type: Number, required: true, min: 0 },
  overpayment: { type: Boolean, default: false },
}, { timestamps: true });

feePaymentSchema.index({ admissionNumber: 1, academicYear: 1, status: 1 });
feePaymentSchema.index({ paymentDate: -1 });
feePaymentSchema.index({ status: 1, paymentDate: -1 });

module.exports = registerModel('FeePayment', feePaymentSchema);
