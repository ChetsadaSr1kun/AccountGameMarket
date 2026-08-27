const publicProductRepository = require('../repositories/public-product.repository');
const imageRepository = require('../repositories/product-image.repository');
const AppError = require('../utils/app-error');

async function getPublicProduct(productId) {
  const product = await publicProductRepository.findPublicById(productId);
  if (!product) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
  product.images = await imageRepository.listByProductId(productId);
  product.attributes = await publicProductRepository.listPublicAttributes(productId);
  return product;
}

module.exports = { getPublicProduct };