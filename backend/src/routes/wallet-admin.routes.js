const express = require('express');
const controller = require('../controllers/wallet-admin.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { requireCsrf } = require('../middleware/csrf.middleware');

const router = express.Router();

router.get('/topup/pending', authenticate, authorize('ADMIN'), controller.listPending);
router.post('/topup/:id/approve', authenticate, authorize('ADMIN'), requireCsrf, controller.approve);
router.post('/topup/:id/reject', authenticate, authorize('ADMIN'), requireCsrf, controller.reject);
router.get('/withdrawal/pending', authenticate, authorize('ADMIN'), controller.listPendingWithdrawals);
router.post('/withdrawal/:id/approve', authenticate, authorize('ADMIN'), requireCsrf, controller.approveWithdrawal);
router.post('/withdrawal/:id/reject', authenticate, authorize('ADMIN'), requireCsrf, controller.rejectWithdrawal);

module.exports = router;