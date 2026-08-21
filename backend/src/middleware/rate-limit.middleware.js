const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

function limit(message, windowMs, max) {
  return rateLimit({ windowMs, limit: max, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message } } });
}

function authenticatedUserLimit(message, windowMs, max) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => (req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip)),
    message: { error: { code: 'RATE_LIMITED', message } },
  });
}

module.exports = {
  globalLimit: limit('Too many requests. Please try again later.', 15 * 60 * 1000, 300),
  loginLimit: limit('Too many login attempts.', 30 * 1000, 100),
  forgotPasswordLimit: limit('Too many reset requests. Please try again later.', 60 * 60 * 1000, 3),
  emailVerificationSendLimit: authenticatedUserLimit('Too many verification emails. Please try again later.', 15 * 60 * 1000, 3),
  emailVerificationVerifyLimit: authenticatedUserLimit('Too many verification attempts. Please try again later.', 15 * 60 * 1000, 10),
  phoneVerificationSendLimit: authenticatedUserLimit('Too many verification SMS requests. Please try again later.', 15 * 60 * 1000, 3),
  phoneVerificationVerifyLimit: authenticatedUserLimit('Too many phone verification attempts. Please try again later.', 15 * 60 * 1000, 10),
};
