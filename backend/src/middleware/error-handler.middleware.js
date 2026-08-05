const AppError = require('../utils/app-error');
const config = require('../config/env');

function notFound(req, res, next) { next(new AppError('API endpoint not found.', 404, 'NOT_FOUND')); }

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: { code: 'DUPLICATE_RESOURCE', message: 'This value is already in use.' } });
  }
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) console.error(error);
  const body = { error: { code: error.code || 'INTERNAL_ERROR', message: statusCode >= 500 && config.isProduction ? 'An unexpected error occurred.' : error.message } };
  if (error.fields) body.error.fields = error.fields;
  return res.status(statusCode).json(body);
}

module.exports = { notFound, errorHandler };
