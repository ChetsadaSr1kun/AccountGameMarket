const express = require('express');
const controller = require('../controllers/seller-profile.controller');

const router = express.Router();
router.get('/:sellerId', controller.getProfile);

module.exports = router;
