const { PAYMENT_MODES } = require('../../constants');
const { parseRupees } = require('../../utils/money');
const { requiredText, optionalText, assertAcademicYear } = require('../../utils/validate');
const ApiError = require('../../utils/ApiError');

function validatePayment(body) {
  const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
  if (!/^[A-Za-z0-9:_-]{16,80}$/.test(idempotencyKey)) {
    throw new ApiError(400, 'A valid idempotency key is required.', 'INVALID_IDEMPOTENCY_KEY');
  }

  const admissionNumber = requiredText(body?.admissionNumber, 'Admission number', { min: 3, max: 30 });
  if (!/^[A-Za-z0-9/-]+$/.test(admissionNumber)) {
    throw new ApiError(400, 'Admission number contains invalid characters.', 'VALIDATION_ERROR');
  }

  const academicYear = assertAcademicYear(body?.academicYear);
  const amountPaise = parseRupees(body?.amount, { fieldName: 'Payment amount' });
  const paymentMode = typeof body?.paymentMode === 'string' ? body.paymentMode.trim().toLowerCase() : '';
  if (!PAYMENT_MODES.some((mode) => mode.value === paymentMode)) {
    throw new ApiError(400, 'Choose cash, bank transfer, or cheque.', 'VALIDATION_ERROR');
  }

  let chequeNumber = '';
  let referenceNumber = '';
  if (paymentMode === 'cheque') {
    chequeNumber = requiredText(body?.chequeNumber, 'Cheque number', { min: 4, max: 30 });
  }
  if (paymentMode === 'bank_transfer') {
    referenceNumber = requiredText(body?.referenceNumber, 'Transfer reference', { min: 4, max: 40 });
  }

  return {
    idempotencyKey,
    admissionNumber,
    academicYear,
    amountPaise,
    paymentMode,
    chequeNumber,
    referenceNumber,
    remarks: optionalText(body?.remarks, 'Remarks', { min: 1, max: 200 }),
    approvedOverpayment: body?.approvedOverpayment === true,
  };
}

module.exports = { validatePayment };
