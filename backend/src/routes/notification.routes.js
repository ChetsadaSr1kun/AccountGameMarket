const express = require('express');
const controller = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireCsrf } = require('../middleware/csrf.middleware');

const router = express.Router();
router.get('/', authenticate, controller.list);
router.get('/unread-count', authenticate, controller.count);
router.patch('/read-all', authenticate, requireCsrf, controller.markAllRead);
router.patch('/:id/read', authenticate, requireCsrf, controller.markRead);
module.exports = router;
