const User = require('../../models/User');
const FeeAccount = require('../../models/FeeAccount');
const FeePayment = require('../../models/FeePayment');
const FeeStructure = require('../../models/FeeStructure');
const Receipt = require('../../models/Receipt');
const studentDirectory = require('../../integrations/students');
const { resolveStructureForStudent } = require('../feeStructure/feeStructure.service');
const ApiError = require('../../utils/ApiError');
const { assertAcademicYear, assertObjectId, pageParams } = require('../../utils/validate');
const { presentStudent, presentFeeAccount, presentPayment, presentReceipt, paged } = require('../../utils/present');

async function linkedStudent(userId) {
  const user = await User.findOne({ _id: userId, role: 'STUDENT', active: true });
  if (!user?.studentAdmissionNumber) throw new ApiError(409, 'Your account needs to be linked to a student record by the administrator.', 'STUDENT_NOT_LINKED');
  const student = await studentDirectory.getStudentByAdmissionNumber(user.studentAdmissionNumber);
  if (!student) throw new ApiError(409, 'Your linked student record is unavailable. Contact the accounts office.', 'STUDENT_NOT_FOUND');
  return student;
}
const scope = student => ({ studentId: student.id, admissionNumber: student.admissionNumber });
async function yearsFor(student) {
  const [accounts,payments,receipts] = await Promise.all([
    FeeAccount.distinct('academicYear', scope(student)), FeePayment.distinct('academicYear', scope(student)), Receipt.distinct('academicYear', scope(student)),
  ]);
  return [...new Set([student.academicYear, ...accounts, ...payments, ...receipts])].sort().reverse();
}
async function yearFor(student, requested) {
  const academicYear = requested ? assertAcademicYear(requested) : student.academicYear;
  const years = await yearsFor(student);
  if (!years.includes(academicYear)) throw new ApiError(404, 'No fee records were found for that academic year.', 'YEAR_NOT_FOUND');
  return { academicYear, years };
}
async function overview(userId, query = {}) {
  const student = await linkedStudent(userId);
  const { academicYear, years } = await yearFor(student, query.academicYear);
  const filter = { ...scope(student), academicYear };
  const [account, payments, receipts, receiptCount] = await Promise.all([
    FeeAccount.findOne(filter), FeePayment.find(filter).sort({ paymentDate: -1, createdAt: -1 }).limit(5),
    Receipt.find(filter).sort({ paymentDate: -1, createdAt: -1 }).limit(5), Receipt.countDocuments({ ...filter, status: 'active' }),
  ]);
  const structure = account ? await FeeStructure.findById(account.feeStructureId) : academicYear === student.academicYear ? await resolveStructureForStudent(student) : null;
  const ledger = account || (structure ? { ...scope(student), studentName: student.name, className: student.className,
    section: student.section, academicYear, feeStructureId: structure._id, totalAmountPaise: structure.totalAmountPaise,
    paidAmountPaise: 0, pendingAmountPaise: structure.totalAmountPaise, advancePaise: 0 } : null);
  return { student: presentStudent(student), academicYear, academicYears: years,
    account: ledger ? presentFeeAccount(ledger, structure) : null,
    recentPayments: payments.map(presentPayment), recentReceipts: receipts.map(presentReceipt), activeReceiptCount: receiptCount };
}
async function history(userId, query, kind) {
  const student = await linkedStudent(userId);
  const { academicYear } = await yearFor(student, query.academicYear);
  const { page, limit, skip } = pageParams(query);
  const model = kind === 'receipts' ? Receipt : FeePayment;
  const present = kind === 'receipts' ? presentReceipt : presentPayment;
  const filter = { ...scope(student), academicYear };
  const [items, total] = await Promise.all([model.find(filter).sort({ paymentDate: -1, createdAt: -1 }).skip(skip).limit(limit), model.countDocuments(filter)]);
  return paged(items.map(present), page, limit, total);
}
async function receipt(userId, receiptId) {
  const student = await linkedStudent(userId);
  const item = await Receipt.findOne({ _id: assertObjectId(receiptId), ...scope(student) });
  if (!item) throw new ApiError(404, 'Receipt not found.', 'NOT_FOUND');
  return presentReceipt(item);
}
module.exports = { overview, history, receipt };
