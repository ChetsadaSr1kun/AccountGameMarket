const express = require('express');
const orderController = require('../controllers/order.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireCsrf } = require('../middleware/csrf.middleware');

const router = express.Router();
router.use(authenticate);
router.post('/', requireCsrf, orderController.createOrder);
router.post('/:id/pay', requireCsrf, orderController.payOrder);
router.post('/:id/confirm-received', requireCsrf, orderController.confirmOrderReceived);
router.get('/', orderController.listOrders);
router.get('/:id/credentials', orderController.getOrderCredentials);
router.get('/:id', orderController.getOrder);

module.exports = router;