const express = require('express');
const controller = require('../controllers/admin-product.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { requireCsrf } = require('../middleware/csrf.middleware');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));
router.get('/summary', controller.getSummary);
router.get('/', controller.list);
router.get('/:productId', controller.detail);
router.patch('/:productId/moderation', requireCsrf, controller.moderate);
module.exports = router;
