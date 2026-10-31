const ApiError = require('../../utils/ApiError');

function calculateBalance(totalPaise, paidPaise) {
  return {
    pendingPaise: Math.max(totalPaise - paidPaise, 0),
    advancePaise: Math.max(paidPaise - totalPaise, 0),
  };
}

function assertPaymentWithinDues({ amountPaise, pendingPaise, allowOverpayment }) {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new ApiError(400, 'Payment amount must be greater than zero.', 'INVALID_AMOUNT');
  }
  if (amountPaise > pendingPaise && !allowOverpayment) {
    throw new ApiError(400, 'Payment exceeds the pending dues. Overpayment is not allowed.', 'OVERPAYMENT_NOT_ALLOWED');
  }
}

module.exports = { calculateBalance, assertPaymentWithinDues };
