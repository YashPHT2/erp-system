const crypto = require('crypto');
const RateLimit = require('../models/RateLimit');
const ApiError = require('../utils/ApiError');
const { asyncHandler } = require('./asyncHandler');

function rateLimit(scope, max = 20, windowMs = 15 * 60 * 1000) {
  return asyncHandler(async (req, res, next) => {
    const bucket = Math.floor(Date.now() / windowMs);
    const digest = crypto.createHash('sha256').update(`${scope}:${req.ip}`).digest('hex');
    const key = `${digest}:${bucket}`;
    let record;
    try {
      record = await RateLimit.findOneAndUpdate({ key }, {
        $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 1) * windowMs) },
      }, { upsert: true, new: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      record = await RateLimit.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true });
    }
    if (record.count > max) {
      res.set('Retry-After', String(Math.ceil(((bucket + 1) * windowMs - Date.now()) / 1000)));
      throw new ApiError(429, 'Too many attempts. Please try again later.', 'RATE_LIMITED');
    }
    next();
  });
}
module.exports = { rateLimit };
