const express = require('express');
const controller = require('../controllers/wallet-topup.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireCsrf } = require('../middleware/csrf.middleware');

const router = express.Router();

router.get('/requests', authenticate, controller.listMyRequests);
router.post('/requests', authenticate, requireCsrf, controller.createMyRequest);

module.exports = router;