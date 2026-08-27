const express = require('express');
const publicProductController = require('../controllers/public-product.controller');
const publicProductListController = require('../controllers/public-product-list.controller');

const router = express.Router();

router.get('/', publicProductListController.listPublicProducts);
router.get('/:id', publicProductController.getPublicProduct);

module.exports = router;
