const ApiError = require('./ApiError');
const { requiredText } = require('./validate');
function emailAddress(value) {
  const email = requiredText(value, 'Email', { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'Enter a valid email address.', 'VALIDATION_ERROR');
  return email;
}
function password(value) {
  if (typeof value !== 'string' || value.length < 12 || Buffer.byteLength(value, 'utf8') > 72) {
    throw new ApiError(400, 'Password must contain at least 12 characters and at most 72 UTF-8 bytes.', 'VALIDATION_ERROR');
  }
  return value;
}
module.exports = { emailAddress, password };
