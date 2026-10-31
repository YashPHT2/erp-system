const ApiError = require('./ApiError');

const MAX_RUPEES = 10000000;

function parseRupees(input, { allowZero = false, fieldName = 'Amount' } = {}) {
  let text = input;
  if (typeof text === 'number') {
    if (!Number.isFinite(text)) {
      throw new ApiError(400, `${fieldName} must be a valid amount.`, 'INVALID_AMOUNT');
    }
    text = String(text);
  }
  if (typeof text !== 'string') {
    throw new ApiError(400, `${fieldName} must be a valid amount.`, 'INVALID_AMOUNT');
  }

  text = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new ApiError(
      400,
      `${fieldName} must be a non-negative number with up to 2 decimal places.`,
      'INVALID_AMOUNT',
    );
  }

  const [whole, fraction = ''] = text.split('.');
  if (whole.length > 1 && whole.startsWith('0')) {
    throw new ApiError(400, `${fieldName} must be a valid amount.`, 'INVALID_AMOUNT');
  }

  const paise = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
  if (!Number.isSafeInteger(paise) || paise > MAX_RUPEES * 100) {
    throw new ApiError(400, `${fieldName} exceeds the allowed limit.`, 'INVALID_AMOUNT');
  }
  if (!allowZero && paise === 0) {
    throw new ApiError(400, `${fieldName} must be greater than zero.`, 'INVALID_AMOUNT');
  }
  return paise;
}

function fromPaise(paise) {
  const value = Number(paise) || 0;
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  const rupees = Math.trunc(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');
  return Number(`${sign}${rupees}.${fraction}`);
}

function rupeeString(paise) {
  return fromPaise(paise).toFixed(2);
}

function formatInr(paise) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromPaise(paise));
}

function sumPaise(values) {
  return values.reduce((total, value) => total + value, 0);
}

module.exports = {
  MAX_RUPEES,
  parseRupees,
  fromPaise,
  rupeeString,
  formatInr,
  sumPaise,
};
