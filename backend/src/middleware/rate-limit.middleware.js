const { rateLimit } = require('express-rate-limit');

function limit(message, windowMs, max) {
  return rateLimit({ windowMs, limit: max, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message } } });
}

module.exports = {
  globalLimit: limit('Too many requests. Please try again later.', 15 * 60 * 1000, 300),
  loginLimit: limit('Too many login attempts.', 30 * 1000, 100),
  forgotPasswordLimit: limit('Too many reset requests. Please try again later.', 60 * 60 * 1000, 3),
};
