const AppError = require('../utils/app-error');

function requireCsrf(req, res, next) {
  const cookieToken = req.cookies.gm_csrf;
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(new AppError('CSRF validation failed.', 403, 'CSRF_INVALID'));
  }
  return next();
}

module.exports = { requireCsrf };
