const publicProductRepository =
  require('../repositories/public-product.repository');

const imageRepository =
  require('../repositories/product-image.repository');

const valorantVerificationRepository =
  require('../repositories/valorant-verification.repository');

const AppError =
  require('../utils/app-error');


async function getPublicProduct(
  productId
) {
  const product =
    await publicProductRepository
      .findPublicById(productId);

  if (!product) {
    throw new AppError(
      'Product not found.',
      404,
      'PRODUCT_NOT_FOUND'
    );
  }

  product.images =
    await imageRepository
      .listByProductId(productId);

  const verification =
    await valorantVerificationRepository
      .findByProductId(productId);

  product.valorantVerification =
    verification
      ? {
          verified: true,

          lastCheckedAt:
            verification.lastCheckedAt,
        }
      : null;

  return product;
}


module.exports = {
  getPublicProduct,
};