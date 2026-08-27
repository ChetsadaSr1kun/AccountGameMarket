const express = require('express');
const controller = require('../controllers/review-report.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { requireCsrf } = require('../middleware/csrf.middleware');

const router = express.Router();
router.post('/', authenticate, requireCsrf, controller.createReport);
router.get('/pending', authenticate, authorize('ADMIN'), controller.listPendingReports);
router.patch('/:reportId', authenticate, authorize('ADMIN'), requireCsrf, controller.resolveReport);

module.exports = router;
