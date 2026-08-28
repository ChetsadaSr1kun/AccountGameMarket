const express = require('express');
const controller = require('../controllers/admin-user.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();
router.get('/', authenticate, authorize('ADMIN'), controller.list);
router.get('/:userId', authenticate, authorize('ADMIN'), controller.detail);
module.exports = router;
