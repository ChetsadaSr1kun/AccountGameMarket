const express = require('express');
const controller = require('../controllers/withdrawal.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/', controller.listMyRequests);
router.post('/', controller.createRequest);

module.exports = router;