class ApiError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || 'ERROR';
    this.details = details;
  }
}

module.exports = ApiError;
