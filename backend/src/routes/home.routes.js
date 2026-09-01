const express = require('express');
const controller = require('../controllers/home.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.get('/stats', controller.stats);
router.get('/me', authenticate, controller.me);

module.exports = router;
