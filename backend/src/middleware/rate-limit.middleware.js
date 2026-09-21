const { MemoryStore, rateLimit, ipKeyGenerator } = require('express-rate-limit');

const GLOBAL_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const GLOBAL_LIMIT_MAX = 300;
const globalLimitStore = new MemoryStore();

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

const globalLimit = rateLimit({
  windowMs: GLOBAL_LIMIT_WINDOW_MS,
  limit: GLOBAL_LIMIT_MAX,
  store: globalLimitStore,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
});

async function resetGlobalLimitForTests() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Global rate-limit state can only be reset in tests.');
  }
  await globalLimitStore.resetAll();
}

module.exports = {
  globalLimit,
  GLOBAL_LIMIT_MAX,
  resetGlobalLimitForTests,
  loginLimit: limit('Too many login attempts.', 30 * 1000, 100),
  forgotPasswordLimit: limit('Too many reset requests. Please try again later.', 60 * 60 * 1000, 3),
  resetPasswordLimit: limit('Too many password reset attempts. Please try again later.', 15 * 60 * 1000, 10),
  emailVerificationSendLimit: authenticatedUserLimit('Too many verification emails. Please try again later.', 15 * 60 * 1000, 3),
  emailVerificationVerifyLimit: authenticatedUserLimit('Too many verification attempts. Please try again later.', 15 * 60 * 1000, 10),
  phoneVerificationSendLimit: authenticatedUserLimit('Too many verification SMS requests. Please try again later.', 15 * 60 * 1000, 3),
  phoneVerificationVerifyLimit: authenticatedUserLimit('Too many phone verification attempts. Please try again later.', 15 * 60 * 1000, 10),
};
