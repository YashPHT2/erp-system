const FeeStructure = require('../../models/FeeStructure');
const FeeAccount = require('../../models/FeeAccount');
const ApiError = require('../../utils/ApiError');
const config = require('../../config/env');
const { validateFeeStructure } = require('./feeStructure.validation');
const { calculateBalance } = require('../feeCollection/feeMath');
const {
  classKey,
  queryString,
  pageParams,
  actorSnapshot,
  assertObjectId,
  assertAcademicYear,
  escapeRegex,
} = require('../../utils/validate');
const { presentFeeStructure, paged } = require('../../utils/present');
const { runInTransaction, withSession, updateOptions } = require('../../utils/transaction');

function pickStructure(structures, student) {
  const key = classKey(student.className);
  const section = (student.section || '').trim().toUpperCase();
  return structures.find((item) => item.academicYear === student.academicYear && item.classKey === key && item.sectionKey === section)
    || structures.find((item) => item.academicYear === student.academicYear && item.classKey === key && item.sectionKey === '')
    || null;
}

async function resolveStructureForStudent(student) {
  const structures = await FeeStructure.find({ academicYear: student.academicYear });
  return pickStructure(structures, student);
}

async function listFeeStructures(query) {
  const filter = {};
  const academicYear = queryString(query, 'academicYear');
  const className = queryString(query, 'className');
  const search = queryString(query, 'search');
  if (academicYear) filter.academicYear = assertAcademicYear(academicYear);
  if (className) filter.classKey = classKey(className);
  if (search) filter.className = { $regex: escapeRegex(search), $options: 'i' };

  const { page, limit, skip } = pageParams(query);
  const [items, total] = await Promise.all([
    FeeStructure.find(filter).sort({ academicYear: -1, className: 1, section: 1 }).skip(skip).limit(limit),
    FeeStructure.countDocuments(filter),
  ]);
  return paged(items.map(presentFeeStructure), page, limit, total);
}

async function getFeeStructure(id) {
  assertObjectId(id);
  const structure = await FeeStructure.findById(id);
  if (!structure) throw new ApiError(404, 'Fee structure not found.', 'FEE_STRUCTURE_NOT_FOUND');
  return presentFeeStructure(structure);
}

async function createFeeStructure(body, actor) {
  // Step 1: Validate components and reject negative or zero amounts.
  const value = validateFeeStructure(body);

  // Step 2: Keep one structure per class, section, and academic year.
  const existing = await FeeStructure.findOne({
    academicYear: value.academicYear,
    classKey: value.classKey,
    sectionKey: value.sectionKey,
  });
  if (existing) {
    throw new ApiError(409, 'A fee structure already exists for this class, section, and academic year.', 'DUPLICATE_FEE_STRUCTURE');
  }

  // Step 3: Save the structure with the calculated total.
  const doc = await FeeStructure.create({
    ...value,
    createdBy: actorSnapshot(actor),
    updatedBy: actorSnapshot(actor),
  });
  return presentFeeStructure(doc);
}

async function updateFeeStructure(id, body, actor) {
  assertObjectId(id);
  const value = validateFeeStructure(body);
  const structure = await FeeStructure.findById(id);
  if (!structure) throw new ApiError(404, 'Fee structure not found.', 'FEE_STRUCTURE_NOT_FOUND');

  const duplicate = await FeeStructure.findOne({
    _id: { $ne: structure._id },
    academicYear: value.academicYear,
    classKey: value.classKey,
    sectionKey: value.sectionKey,
  });
  if (duplicate) {
    throw new ApiError(409, 'Another fee structure already uses this class, section, and academic year.', 'DUPLICATE_FEE_STRUCTURE');
  }

  // Step 1: Update the structure and every linked fee account together.
  return runInTransaction(async (session) => {
    const accounts = await withSession(FeeAccount.find({ feeStructureId: structure._id }), session);
    const identityChanged = structure.classKey !== value.classKey
      || structure.sectionKey !== value.sectionKey
      || structure.academicYear !== value.academicYear;
    if (identityChanged && accounts.length > 0) {
      throw new ApiError(409, 'Class, section, and academic year cannot change after fees have been posted.', 'STRUCTURE_IN_USE');
    }

    // Step 2: Reject a total that would fall below money already collected.
    for (const account of accounts) {
      if (account.paidAmountPaise > value.totalAmountPaise && !config.isOverpaymentAllowed()) {
        throw new ApiError(
          409,
          `The new total is below the amount already collected for ${account.admissionNumber}.`,
          'TOTAL_BELOW_COLLECTED',
          { admissionNumber: account.admissionNumber },
        );
      }
    }

    structure.set({ ...value, updatedBy: actorSnapshot(actor) });
    if (session) await structure.save({ session });
    else await structure.save();

    // Step 3: Recalculate pending balances from the new total.
    for (const account of accounts) {
      const balances = calculateBalance(value.totalAmountPaise, account.paidAmountPaise);
      await FeeAccount.updateOne(
        { _id: account._id },
        {
          $set: {
            totalAmountPaise: value.totalAmountPaise,
            pendingAmountPaise: balances.pendingPaise,
            advancePaise: balances.advancePaise,
          },
          $inc: { version: 1 },
        },
        updateOptions(session),
      );
    }

    return presentFeeStructure(structure);
  });
}

module.exports = {
  pickStructure,
  resolveStructureForStudent,
  listFeeStructures,
  getFeeStructure,
  createFeeStructure,
  updateFeeStructure,
};
