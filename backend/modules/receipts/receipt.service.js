const Receipt = require('../../models/Receipt');
const FeePayment = require('../../models/FeePayment');
const FeeAccount = require('../../models/FeeAccount');
const ApiError = require('../../utils/ApiError');
const { validateCancellation } = require('./receipt.validation');
const { calculateBalance } = require('../feeCollection/feeMath');
const {
  queryString,
  pageParams,
  actorSnapshot,
  assertObjectId,
  escapeRegex,
} = require('../../utils/validate');
const { presentReceipt, paged } = require('../../utils/present');
const { runInTransaction, withSession, updateOptions } = require('../../utils/transaction');
const { parseIsoDate, zonedDateTimeToUtc, addDays } = require('../../utils/dates');
const config = require('../../config/env');

function dateRange(query) {
  const from = parseIsoDate(queryString(query, 'from', 10));
  const to = parseIsoDate(queryString(query, 'to', 10));
  const range = {};
  if (from) range.$gte = zonedDateTimeToUtc(from.year, from.month, from.day, 0, 0, 0, config.timezone);
  if (to) range.$lt = addDays(zonedDateTimeToUtc(to.year, to.month, to.day, 0, 0, 0, config.timezone), 1);
  return range;
}

function receiptFilter(query) {
  const filter = {};
  const search = queryString(query, 'search');
  const mode = queryString(query, 'paymentMode');
  const status = queryString(query, 'status');
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ studentName: pattern }, { admissionNumber: pattern }, { receiptNumber: pattern }];
  }
  if (['cash', 'bank_transfer', 'cheque'].includes(mode)) filter.paymentMode = mode;
  if (['active', 'cancelled'].includes(status)) filter.status = status;
  const range = dateRange(query);
  if (range.$gte || range.$lt) filter.paymentDate = range;
  return filter;
}

async function listReceipts(query) {
  const { page, limit, skip } = pageParams(query);
  const [items, total] = await Promise.all([
    Receipt.find(receiptFilter(query)).sort({ paymentDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    Receipt.countDocuments(receiptFilter(query)),
  ]);
  return paged(items.map(presentReceipt), page, limit, total);
}

async function getReceipt(id) {
  assertObjectId(id);
  const receipt = await Receipt.findById(id);
  if (!receipt) throw new ApiError(404, 'Receipt not found.', 'RECEIPT_NOT_FOUND');
  return presentReceipt(receipt);
}

async function cancelReceipt(id, body, actor) {
  assertObjectId(id);
  const { reason } = validateCancellation(body);

  // Step 1: Cancel the receipt and reverse the ledger in one transaction.
  return runInTransaction(async (session) => {
    const receipt = await withSession(Receipt.findById(id), session);
    if (!receipt) throw new ApiError(404, 'Receipt not found.', 'RECEIPT_NOT_FOUND');
    if (receipt.status === 'cancelled') {
      throw new ApiError(409, 'This receipt is already cancelled.', 'RECEIPT_ALREADY_CANCELLED');
    }

    // Step 2: Load the original payment. Cancelled receipts stay in the database.
    const payment = await withSession(FeePayment.findById(receipt.paymentId), session);
    if (!payment || payment.status !== 'completed') {
      throw new ApiError(409, 'The payment for this receipt cannot be reversed.', 'PAYMENT_NOT_ACTIVE');
    }

    const account = await withSession(FeeAccount.findById(payment.feeAccountId), session);
    if (!account) throw new ApiError(409, 'The fee account for this receipt is missing.', 'FEE_ACCOUNT_NOT_FOUND');

    const nextPaid = account.paidAmountPaise - payment.amountPaise;
    if (nextPaid < 0) {
      throw new ApiError(409, 'The fee account does not have enough recorded payment to reverse this receipt.', 'BALANCE_MISMATCH');
    }
    const balances = calculateBalance(account.totalAmountPaise, nextPaid);

    // Step 3: Restore the outstanding balance, then mark the receipt cancelled.
    const updated = await FeeAccount.findOneAndUpdate(
      { _id: account._id, version: account.version, paidAmountPaise: { $gte: payment.amountPaise } },
      {
        $set: {
          paidAmountPaise: nextPaid,
          pendingAmountPaise: balances.pendingPaise,
          advancePaise: balances.advancePaise,
          version: account.version + 1,
        },
      },
      updateOptions(session, { new: true }),
    );
    if (!updated) {
      throw new ApiError(409, 'The fee balance changed while this receipt was being cancelled. Try again.', 'CONCURRENT_UPDATE');
    }

    payment.status = 'cancelled';
    if (session) await payment.save({ session });
    else await payment.save();

    receipt.status = 'cancelled';
    receipt.cancellation = {
      reason,
      cancelledBy: actorSnapshot(actor),
      cancelledAt: new Date(),
      reversedAmountPaise: payment.amountPaise,
    };
    if (session) await receipt.save({ session });
    else await receipt.save();

    return presentReceipt(receipt);
  });
}

module.exports = { listReceipts, getReceipt, cancelReceipt, receiptFilter };
