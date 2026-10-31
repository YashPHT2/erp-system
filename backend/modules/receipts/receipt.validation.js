const { requiredText } = require('../../utils/validate');

function validateCancellation(body) {
  return {
    reason: requiredText(body?.reason, 'Cancellation reason', { min: 5, max: 500 }),
  };
}

module.exports = { validateCancellation };
