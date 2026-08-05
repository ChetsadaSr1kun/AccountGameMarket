class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', fields) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
  }
}

module.exports = AppError;
