const express = require('express');
const productController = require('../controllers/product.controller');
const productImageController = require('../controllers/product-image.controller');
const { uploadProductImages } = require('../middleware/product-image-upload.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { requireCsrf } = require('../middleware/csrf.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createProductSchema, updateProductSchema } = require('../validators/product.validator');

const router = express.Router();

router.use(authenticate, authorize('SELLER'));
router.get('/', productController.listMyProducts);
router.get('/:id/images', productImageController.listMyProductImages);
router.post('/:id/images', requireCsrf, uploadProductImages, productImageController.uploadMyProductImages);
router.delete('/:id/images/:imageId', requireCsrf, productImageController.deleteMyProductImage);
router.get('/:id', productController.getMyProduct);
router.post('/', requireCsrf, validate(createProductSchema), productController.createMyProduct);
router.patch('/:id', requireCsrf, validate(updateProductSchema), productController.updateMyProduct);
router.delete('/:id', requireCsrf, productController.deleteMyProduct);

module.exports = router;
