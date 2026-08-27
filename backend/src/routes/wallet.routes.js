const express = require('express');
const walletController = require('../controllers/wallet.controller');
const withdrawalController = require('../controllers/withdrawal.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/', walletController.getWallet);
router.get('/withdrawals', withdrawalController.listMyRequests);
router.post('/withdrawals', withdrawalController.createRequest);

module.exports = router;