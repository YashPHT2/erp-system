const FeeAccount = require('../../models/FeeAccount');
const FeePayment = require('../../models/FeePayment');
const Receipt = require('../../models/Receipt');
const Counter = require('../../models/Counter');
const ApiError = require('../../utils/ApiError');
const config = require('../../config/env');
const studentDirectory = require('../../integrations/students');
const { validatePayment } = require('./feeCollection.validation');
const { calculateBalance, assertPaymentWithinDues } = require('./feeMath');
const { resolveStructureForStudent } = require('../feeStructure/feeStructure.service');
const { formatReceiptNumber } = require('../../utils/receiptNumber');
const { getZonedParts } = require('../../utils/dates');
const {
  classKey,
  sectionKey,
  queryString,
  pageParams,
  actorSnapshot,
  assertObjectId,
  assertAcademicYear,
  escapeRegex,
} = require('../../utils/validate');
const {
  presentStudent,
  presentFeeStructure,
  presentFeeAccount,
  presentPayment,
  presentReceipt,
  paged,
} = require('../../utils/present');
const {
  runInTransaction,
  withSession,
  updateOptions,
  createDoc,
} = require('../../utils/transaction');

const PAYMENT_SORTS = {
  newest: { paymentDate: -1, createdAt: -1 },
  oldest: { paymentDate: 1, createdAt: 1 },
  amount: { amountPaise: -1 },
};

function classesMatch(account, student) {
  return classKey(account.className) === classKey(student.className)
    && sectionKey(account.section) === sectionKey(student.section);
}

async function nextReceiptNumber(paymentDate) {
  // Allocate outside the payment transaction. A rolled-back payment leaves a gap,
  // which is safer than reusing a receipt number.
  const year = getZonedParts(paymentDate, config.timezone).year;
  const counter = await Counter.findOneAndUpdate(
    { _id: `receipt-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return formatReceiptNumber(year, counter.seq);
}

async function ensureFeeAccount(student, structure) {
  const existing = await FeeAccount.findOne({
    admissionNumber: student.admissionNumber,
    academicYear: student.academicYear,
  });
  if (existing) return existing;

  try {
    return await FeeAccount.create({
      studentId: student.id,
      admissionNumber: student.admissionNumber,
      studentName: student.name,
      className: student.className,
      section: student.section || '',
      academicYear: student.academicYear,
      feeStructureId: structure._id,
      totalAmountPaise: structure.totalAmountPaise,
      paidAmountPaise: 0,
      pendingAmountPaise: structure.totalAmountPaise,
      advancePaise: 0,
      version: 0,
    });
  } catch (error) {
    if (error.code === 11000) {
      return FeeAccount.findOne({
        admissionNumber: student.admissionNumber,
        academicYear: student.academicYear,
      });
    }
    throw error;
  }
}

async function replayPayment(existing) {
  const receipt = existing.receiptId ? await Receipt.findById(existing.receiptId) : null;
  return {
    replayed: true,
    payment: presentPayment(existing),
    receipt: receipt ? presentReceipt(receipt) : null,
  };
}

function samePaymentRequest(existing, payment) {
  return existing.admissionNumber.toLowerCase() === payment.admissionNumber.toLowerCase()
    && existing.amountPaise === payment.amountPaise
    && existing.academicYear === payment.academicYear;
}

function isIdempotencyDuplicate(error) {
  return error?.code === 11000 && (error.keyPattern?.idempotencyKey || error.keyValue?.idempotencyKey);
}

async function writePayment({ session, account, student, payment, actor, paymentDate, overpaymentPermitted }) {
  const fresh = await withSession(FeeAccount.findById(account._id), session);
  if (!fresh) throw new ApiError(404, 'Fee account not found.', 'FEE_ACCOUNT_NOT_FOUND');
  if (!classesMatch(fresh, student)) {
    throw new ApiError(409, 'The student class on the fee account does not match the student record. Ask a principal to review it before collecting fees.', 'CLASS_MISMATCH');
  }

  assertPaymentWithinDues({
    amountPaise: payment.amountPaise,
    pendingPaise: fresh.pendingAmountPaise,
    allowOverpayment: overpaymentPermitted,
  });

  const nextPaid = fresh.paidAmountPaise + payment.amountPaise;
  const balances = calculateBalance(fresh.totalAmountPaise, nextPaid);
  const overpayment = payment.amountPaise > fresh.pendingAmountPaise;
  const filter = overpayment
    ? { _id: fresh._id, version: fresh.version }
    : { _id: fresh._id, version: fresh.version, pendingAmountPaise: { $gte: payment.amountPaise } };

  let accountUpdated = false;
  let paymentId = null;
  let receiptId = null;

  try {
    const updated = await FeeAccount.findOneAndUpdate(
      filter,
      {
        $set: {
          paidAmountPaise: nextPaid,
          pendingAmountPaise: balances.pendingPaise,
          advancePaise: balances.advancePaise,
          studentName: student.name,
          version: fresh.version + 1,
        },
      },
      updateOptions(session, { new: true }),
    );
    if (!updated) {
      throw new ApiError(409, 'The fee balance changed while this payment was being saved. Refresh the student and try again.', 'CONCURRENT_UPDATE');
    }
    accountUpdated = true;

    const receiptNumber = await nextReceiptNumber(paymentDate);
    const paymentDoc = await createDoc(FeePayment, {
      idempotencyKey: payment.idempotencyKey,
      studentId: student.id,
      admissionNumber: student.admissionNumber,
      studentName: student.name,
      className: student.className,
      section: student.section || '',
      academicYear: student.academicYear,
      feeStructureId: fresh.feeStructureId,
      feeAccountId: fresh._id,
      amountPaise: payment.amountPaise,
      paymentMode: payment.paymentMode,
      chequeNumber: payment.chequeNumber,
      referenceNumber: payment.referenceNumber,
      remarks: payment.remarks,
      paymentDate,
      receivedBy: actorSnapshot(actor),
      status: 'completed',
      receiptNumber,
      totalFeePaise: fresh.totalAmountPaise,
      paidBeforePaise: fresh.paidAmountPaise,
      pendingBeforePaise: fresh.pendingAmountPaise,
      pendingAfterPaise: balances.pendingPaise,
      overpayment,
    }, session);
    paymentId = paymentDoc._id;

    const receiptDoc = await createDoc(Receipt, {
      receiptNumber,
      paymentId: paymentDoc._id,
      studentId: student.id,
      admissionNumber: student.admissionNumber,
      studentName: student.name,
      className: student.className,
      section: student.section || '',
      academicYear: student.academicYear,
      amountPaise: payment.amountPaise,
      paymentMode: payment.paymentMode,
      chequeNumber: payment.chequeNumber,
      referenceNumber: payment.referenceNumber,
      remarks: payment.remarks,
      paymentDate,
      receivedBy: actorSnapshot(actor),
      remainingBalancePaise: balances.pendingPaise,
      advancePaise: balances.advancePaise,
      status: 'active',
      institutionName: config.institutionName,
    }, session);
    receiptId = receiptDoc._id;
    paymentDoc.receiptId = receiptDoc._id;
    if (session) await paymentDoc.save({ session });
    else await paymentDoc.save();

    return {
      replayed: false,
      payment: presentPayment(paymentDoc),
      receipt: presentReceipt(receiptDoc),
    };
  } catch (error) {
    if (!session) {
      if (receiptId) await Receipt.deleteOne({ _id: receiptId });
      if (paymentId) await FeePayment.deleteOne({ _id: paymentId });
      if (accountUpdated) {
        await FeeAccount.updateOne(
          { _id: fresh._id, version: fresh.version + 1 },
          {
            $set: {
              paidAmountPaise: fresh.paidAmountPaise,
              pendingAmountPaise: fresh.pendingAmountPaise,
              advancePaise: fresh.advancePaise,
              studentName: fresh.studentName,
              version: fresh.version,
            },
          },
        );
      }
    }
    throw error;
  }
}

async function collectFee(body, actor, options = {}) {
  // Step 1: Validate the amount, mode, and idempotency key. Ignore any role or date sent by the client.
  const payment = validatePayment(body);
  const overpaymentPermitted = config.isOverpaymentAllowed() && payment.approvedOverpayment;

  // Step 2: Return the original receipt when this request was already saved.
  const existing = await FeePayment.findOne({ idempotencyKey: payment.idempotencyKey });
  if (existing) {
    if (!samePaymentRequest(existing, payment)) {
      throw new ApiError(409, 'This idempotency key was already used for a different payment.', 'IDEMPOTENCY_CONFLICT');
    }
    return replayPayment(existing);
  }

  // Step 3: Load the student from the student directory.
  const student = await studentDirectory.getStudentByAdmissionNumber(payment.admissionNumber);
  if (!student) throw new ApiError(404, 'No student was found for that admission number.', 'STUDENT_NOT_FOUND');
  if (payment.academicYear !== student.academicYear) {
    throw new ApiError(400, 'The academic year does not match the student record.', 'ACADEMIC_YEAR_MISMATCH');
  }

  // Step 4: Resolve the class fee structure and open a fee account if this is the first payment.
  const structure = await resolveStructureForStudent(student);
  if (!structure) {
    throw new ApiError(404, 'No fee structure is configured for this class and academic year.', 'FEE_STRUCTURE_NOT_FOUND');
  }
  const account = await ensureFeeAccount(student, structure);

  let paymentDate = options.paymentDate ? new Date(options.paymentDate) : new Date();
  if (Number.isNaN(paymentDate.getTime())) {
    throw new ApiError(400, 'Payment date is invalid.', 'VALIDATION_ERROR');
  }
  if (paymentDate.getTime() > Date.now() + 60 * 1000) {
    throw new ApiError(400, 'Payment date cannot be in the future.', 'FUTURE_PAYMENT');
  }

  // Step 5: Save the balance, payment, and receipt together.
  try {
    return await runInTransaction((session) => writePayment({
      session,
      account,
      student,
      payment,
      actor,
      paymentDate,
      overpaymentPermitted,
    }));
  } catch (error) {
    if (isIdempotencyDuplicate(error)) {
      const raced = await FeePayment.findOne({ idempotencyKey: payment.idempotencyKey });
      if (raced) return replayPayment(raced);
    }
    throw error;
  }
}

async function getFeeAccountView(admissionNumber, academicYear) {
  const admission = queryString({ admissionNumber }, 'admissionNumber', 30);
  if (!admission) throw new ApiError(400, 'Admission number is required.', 'VALIDATION_ERROR');

  const student = await studentDirectory.getStudentByAdmissionNumber(admission);
  if (!student) throw new ApiError(404, 'No student was found for that admission number.', 'STUDENT_NOT_FOUND');
  if (academicYear) {
    const year = assertAcademicYear(academicYear);
    if (year !== student.academicYear) {
      throw new ApiError(400, 'The academic year does not match the student record.', 'ACADEMIC_YEAR_MISMATCH');
    }
  }

  const account = await FeeAccount.findOne({
    admissionNumber: student.admissionNumber,
    academicYear: student.academicYear,
  });
  const structure = account
    ? await require('../../models/FeeStructure').findById(account.feeStructureId)
    : await resolveStructureForStudent(student);
  const payments = await FeePayment.find({
    admissionNumber: student.admissionNumber,
    academicYear: student.academicYear,
  }).sort({ paymentDate: -1 }).limit(8);

  if (!structure && !account) {
    return {
      student: presentStudent(student),
      feeStructure: null,
      account: null,
      classMismatch: false,
      recentPayments: payments.map(presentPayment),
    };
  }

  const viewAccount = account || {
    studentId: student.id,
    admissionNumber: student.admissionNumber,
    studentName: student.name,
    className: student.className,
    section: student.section || '',
    academicYear: student.academicYear,
    feeStructureId: structure._id,
    totalAmountPaise: structure.totalAmountPaise,
    paidAmountPaise: 0,
    pendingAmountPaise: structure.totalAmountPaise,
    advancePaise: 0,
  };

  return {
    student: presentStudent(student),
    feeStructure: structure ? presentFeeStructure(structure) : null,
    account: presentFeeAccount(viewAccount, structure),
    classMismatch: Boolean(account) && !classesMatch(account, student),
    recentPayments: payments.map(presentPayment),
  };
}

function paymentFilter(query) {
  const filter = {};
  const search = queryString(query, 'search');
  const mode = queryString(query, 'paymentMode');
  const status = queryString(query, 'status');
  const academicYear = queryString(query, 'academicYear');
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ studentName: pattern }, { admissionNumber: pattern }, { receiptNumber: pattern }];
  }
  if (['cash', 'bank_transfer', 'cheque'].includes(mode)) filter.paymentMode = mode;
  if (['completed', 'cancelled'].includes(status)) filter.status = status;
  if (academicYear) filter.academicYear = academicYear;
  return filter;
}

async function listPayments(query) {
  const { page, limit, skip } = pageParams(query);
  const sort = PAYMENT_SORTS[queryString(query, 'sort')] || PAYMENT_SORTS.newest;
  const filter = paymentFilter(query);
  const [items, total] = await Promise.all([
    FeePayment.find(filter).sort(sort).skip(skip).limit(limit),
    FeePayment.countDocuments(filter),
  ]);
  return paged(items.map(presentPayment), page, limit, total);
}

async function getPayment(id) {
  assertObjectId(id);
  const payment = await FeePayment.findById(id);
  if (!payment) throw new ApiError(404, 'Payment not found.', 'PAYMENT_NOT_FOUND');
  const receipt = payment.receiptId ? await Receipt.findById(payment.receiptId) : null;
  return {
    payment: presentPayment(payment),
    receipt: receipt ? presentReceipt(receipt) : null,
  };
}

module.exports = {
  collectFee,
  getFeeAccountView,
  listPayments,
  getPayment,
};
