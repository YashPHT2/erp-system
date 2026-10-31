const ApiError = require('../utils/ApiError');

function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: 'The requested resource was not found.',
    code: 'NOT_FOUND',
  });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof ApiError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      code: error.code,
      details: error.details || undefined,
    });
  }

  if (error.name === 'ValidationError') {
    const message = Object.values(error.errors).map((item) => item.message).join(' ');
    return res.status(400).json({ success: false, message, code: 'VALIDATION_ERROR' });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid identifier.', code: 'INVALID_ID' });
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Request body must be valid JSON.', code: 'INVALID_JSON' });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'A matching record already exists.',
      code: 'DUPLICATE',
    });
  }

  console.error(error);
  return res.status(500).json({
    success: false,
    message: 'Something went wrong while processing the request.',
    code: 'INTERNAL_ERROR',
  });
}

module.exports = { notFound, errorHandler };
