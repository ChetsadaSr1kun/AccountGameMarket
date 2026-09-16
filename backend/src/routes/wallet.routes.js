const express = require('express');
const walletController = require('../controllers/wallet.controller');
const withdrawalController = require('../controllers/withdrawal.controller');
const withdrawalAttemptController =
  require('../controllers/withdrawal-attempt.controller');
const {
  authenticate,
  requireAccountVerified,
} = require('../middleware/auth.middleware');
const { requireCsrf } = require('../middleware/csrf.middleware');
const {
  emailVerificationSendLimit,
  emailVerificationVerifyLimit,
  phoneVerificationSendLimit,
  phoneVerificationVerifyLimit,
} = require('../middleware/rate-limit.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/', walletController.getWallet);

router.get(
  '/withdrawals',
  withdrawalController.listMyRequests
);

// Legacy direct withdrawal endpoint.
// Keep temporarily for compatibility, but do not use it
// from the new frontend OTP withdrawal flow.
router.post(
  '/withdrawals',
  requireAccountVerified,
  requireCsrf,
  withdrawalController.createRequest
);

// Withdrawal verification attempt flow.
router.post(
  '/withdrawal-attempts',
  requireAccountVerified,
  requireCsrf,
  withdrawalAttemptController.createAttempt
);

router.get(
  '/withdrawal-attempts/:attemptId',
  withdrawalAttemptController.getAttempt
);

router.post(
  '/withdrawal-attempts/:attemptId/email/send',
  requireCsrf,
  emailVerificationSendLimit,
  withdrawalAttemptController.sendEmailOtp
);

router.post(
  '/withdrawal-attempts/:attemptId/email/verify',
  requireCsrf,
  emailVerificationVerifyLimit,
  withdrawalAttemptController.verifyEmailOtp
);

router.post(
  '/withdrawal-attempts/:attemptId/phone/send',
  requireCsrf,
  phoneVerificationSendLimit,
  withdrawalAttemptController.sendPhoneOtp
);

router.post(
  '/withdrawal-attempts/:attemptId/phone/verify',
  requireCsrf,
  phoneVerificationVerifyLimit,
  withdrawalAttemptController.verifyPhoneOtp
);

router.post(
  '/withdrawal-attempts/:attemptId/complete',
  requireCsrf,
  withdrawalAttemptController.completeAttempt
);

router.post(
  '/withdrawal-attempts/:attemptId/cancel',
  requireCsrf,
  withdrawalAttemptController.cancelAttempt
);

module.exports = router;