const express = require('express');
const controller = require('../controllers/wallet-topup.controller');
const { authenticate, requireAccountVerified } = require('../middleware/auth.middleware');
const { requireCsrf } = require('../middleware/csrf.middleware');
const { uploadSlip } = require('../middleware/slip-upload.middleware');

const router = express.Router();
router.get('/requests', authenticate, controller.listMyRequests);
router.post('/requests', authenticate, requireAccountVerified, requireCsrf, controller.createMyRequest);
router.post('/requests/:requestId/slip', authenticate, requireAccountVerified, requireCsrf, uploadSlip, controller.uploadMySlip);

module.exports = router;
