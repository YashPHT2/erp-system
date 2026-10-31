const mongoose = require('mongoose');
const { actorSchema, moneyComponentSchema, registerModel } = require('./shared');

const salaryProfileSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  employeeCode: { type: String, required: true },
  employeeName: { type: String, required: true },
  designation: { type: String, required: true },
  department: { type: String, required: true },
  basicSalaryPaise: { type: Number, required: true, min: 1 },
  allowances: { type: [moneyComponentSchema], default: [] },
  deductions: { type: [moneyComponentSchema], default: [] },
  totalAllowancesPaise: { type: Number, required: true, min: 0 },
  totalDeductionsPaise: { type: Number, required: true, min: 0 },
  netSalaryPaise: { type: Number, required: true, min: 0 },
  updatedBy: { type: actorSchema, required: true },
}, { timestamps: true });

const payrollSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  employeeCode: { type: String, required: true },
  employeeName: { type: String, required: true },
  designation: { type: String, required: true },
  department: { type: String, required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  basicSalaryPaise: { type: Number, required: true, min: 1 },
  allowances: { type: [moneyComponentSchema], default: [] },
  deductions: { type: [moneyComponentSchema], default: [] },
  totalAllowancesPaise: { type: Number, required: true, min: 0 },
  totalDeductionsPaise: { type: Number, required: true, min: 0 },
  netSalaryPaise: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['processed', 'paid'], default: 'processed' },
  processedAt: { type: Date, required: true },
  processedBy: { type: actorSchema, required: true },
  paidAt: { type: Date },
  paidBy: { type: actorSchema },
}, { timestamps: true });

payrollSchema.index({ employeeId: 1, year: 1, month: 1 }, { unique: true });
payrollSchema.index({ year: 1, month: 1, status: 1 });

module.exports = {
  SalaryProfile: registerModel('SalaryProfile', salaryProfileSchema),
  Payroll: registerModel('Payroll', payrollSchema),
};
