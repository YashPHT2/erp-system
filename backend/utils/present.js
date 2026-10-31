const { fromPaise } = require('./money');
const { periodLabel } = require('./dates');
const { ROLE_LABELS } = require('../constants');

function presentActor(actor) {
  if (!actor || !actor.userId) return null;
  return {
    userId: actor.userId,
    name: actor.name,
    role: actor.role,
    roleLabel: ROLE_LABELS[actor.role] || actor.role,
  };
}

function presentComponent(component) {
  return {
    code: component.code,
    label: component.label,
    amount: fromPaise(component.amountPaise),
  };
}

function presentStudent(student) {
  return {
    id: student.id,
    admissionNumber: student.admissionNumber,
    name: student.name,
    className: student.className,
    section: student.section || '',
    academicYear: student.academicYear,
  };
}

function presentEmployee(employee) {
  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    name: employee.name,
    designation: employee.designation,
    department: employee.department,
    status: employee.status || 'active',
  };
}

function presentFeeStructure(doc) {
  return {
    id: String(doc._id),
    academicYear: doc.academicYear,
    className: doc.className,
    section: doc.section || '',
    components: doc.components.map(presentComponent),
    totalAmount: fromPaise(doc.totalAmountPaise),
    createdBy: presentActor(doc.createdBy),
    updatedBy: presentActor(doc.updatedBy),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function presentPayment(doc) {
  return {
    id: String(doc._id),
    idempotencyKey: doc.idempotencyKey,
    studentId: doc.studentId,
    admissionNumber: doc.admissionNumber,
    studentName: doc.studentName,
    className: doc.className,
    section: doc.section || '',
    academicYear: doc.academicYear,
    feeStructureId: doc.feeStructureId ? String(doc.feeStructureId) : null,
    amount: fromPaise(doc.amountPaise),
    paymentMode: doc.paymentMode,
    chequeNumber: doc.chequeNumber || '',
    referenceNumber: doc.referenceNumber || '',
    remarks: doc.remarks || '',
    paymentDate: doc.paymentDate,
    receivedBy: presentActor(doc.receivedBy),
    status: doc.status,
    receiptId: doc.receiptId ? String(doc.receiptId) : null,
    receiptNumber: doc.receiptNumber || '',
    totalFee: fromPaise(doc.totalFeePaise),
    paidBefore: fromPaise(doc.paidBeforePaise),
    pendingBefore: fromPaise(doc.pendingBeforePaise),
    pendingAfter: fromPaise(doc.pendingAfterPaise),
    overpayment: Boolean(doc.overpayment),
    createdAt: doc.createdAt,
  };
}

function presentReceipt(doc) {
  return {
    id: String(doc._id),
    receiptNumber: doc.receiptNumber,
    paymentId: String(doc.paymentId),
    studentId: doc.studentId,
    admissionNumber: doc.admissionNumber,
    studentName: doc.studentName,
    className: doc.className,
    section: doc.section || '',
    academicYear: doc.academicYear,
    amount: fromPaise(doc.amountPaise),
    paymentMode: doc.paymentMode,
    chequeNumber: doc.chequeNumber || '',
    referenceNumber: doc.referenceNumber || '',
    remarks: doc.remarks || '',
    paymentDate: doc.paymentDate,
    receivedBy: presentActor(doc.receivedBy),
    remainingBalance: fromPaise(doc.remainingBalancePaise),
    advanceAmount: fromPaise(doc.advancePaise || 0),
    status: doc.status,
    institutionName: doc.institutionName,
    cancellation: doc.cancellation && doc.cancellation.cancelledAt ? {
      reason: doc.cancellation.reason,
      cancelledBy: presentActor(doc.cancellation.cancelledBy),
      cancelledAt: doc.cancellation.cancelledAt,
      reversedAmount: fromPaise(doc.cancellation.reversedAmountPaise || 0),
    } : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function presentFeeAccount(account, structure) {
  return {
    studentId: account.studentId,
    admissionNumber: account.admissionNumber,
    studentName: account.studentName,
    className: account.className,
    section: account.section || '',
    academicYear: account.academicYear,
    feeStructureId: account.feeStructureId ? String(account.feeStructureId) : null,
    totalFee: fromPaise(account.totalAmountPaise),
    paidAmount: fromPaise(account.paidAmountPaise),
    pendingAmount: fromPaise(account.pendingAmountPaise),
    advanceAmount: fromPaise(account.advancePaise || 0),
    components: structure ? structure.components.map(presentComponent) : [],
  };
}

function presentPayroll(doc) {
  return {
    id: String(doc._id),
    employeeId: doc.employeeId,
    employeeCode: doc.employeeCode,
    employeeName: doc.employeeName,
    designation: doc.designation,
    department: doc.department,
    month: doc.month,
    year: doc.year,
    periodLabel: periodLabel(doc.month, doc.year),
    basicSalary: fromPaise(doc.basicSalaryPaise),
    allowances: doc.allowances.map(presentComponent),
    deductions: doc.deductions.map(presentComponent),
    totalAllowances: fromPaise(doc.totalAllowancesPaise),
    totalDeductions: fromPaise(doc.totalDeductionsPaise),
    netSalary: fromPaise(doc.netSalaryPaise),
    status: doc.status,
    processedAt: doc.processedAt,
    processedBy: presentActor(doc.processedBy),
    paidAt: doc.paidAt || null,
    paidBy: presentActor(doc.paidBy),
  };
}

function presentSalaryProfile(doc) {
  return {
    id: String(doc._id),
    employeeId: doc.employeeId,
    employeeCode: doc.employeeCode,
    employeeName: doc.employeeName,
    designation: doc.designation,
    department: doc.department,
    basicSalary: fromPaise(doc.basicSalaryPaise),
    allowances: doc.allowances.map(presentComponent),
    deductions: doc.deductions.map(presentComponent),
    totalAllowances: fromPaise(doc.totalAllowancesPaise),
    totalDeductions: fromPaise(doc.totalDeductionsPaise),
    netSalary: fromPaise(doc.netSalaryPaise),
    updatedBy: presentActor(doc.updatedBy),
    updatedAt: doc.updatedAt,
  };
}

function paged(items, page, limit, total) {
  return {
    items,
    page,
    limit,
    total,
    pages: Math.max(Math.ceil(total / limit), 1),
  };
}

module.exports = {
  presentActor,
  presentComponent,
  presentStudent,
  presentEmployee,
  presentFeeStructure,
  presentPayment,
  presentReceipt,
  presentFeeAccount,
  presentPayroll,
  presentSalaryProfile,
  paged,
};
