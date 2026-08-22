const express = require('express');
const productController = require('../controllers/product.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createProductSchema, updateProductSchema } = require('../validators/product.validator');

const router = express.Router();

router.use(authenticate, authorize('SELLER'));
router.get('/', productController.listMyProducts);
router.get('/:id', productController.getMyProduct);
router.post('/', validate(createProductSchema), productController.createMyProduct);
router.patch('/:id', validate(updateProductSchema), productController.updateMyProduct);
router.delete('/:id', productController.deleteMyProduct);

module.exports = router;
