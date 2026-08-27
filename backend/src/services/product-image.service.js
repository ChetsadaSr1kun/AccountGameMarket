const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const productRepository = require('../repositories/product.repository');
const imageRepository = require('../repositories/product-image.repository');
const AppError = require('../utils/app-error');
const { withTransaction } = require('../utils/transaction');

const imageDirectory = path.resolve(__dirname, '../../..', 'uploads', 'products');
const imageUrlPrefix = '/uploads/products/';
const MAX_IMAGES = 10;

function assertImageExtension(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

async function removeFiles(paths) {
  await Promise.all(paths.map(async (filePath) => { try { await fs.unlink(filePath); } catch (error) { if (error.code !== 'ENOENT') throw error; } }));
}

async function assertOwnedProduct(user, productId, executor) {
  if (!user.roles.includes('SELLER')) throw new AppError('Seller permission is required.', 403, 'SELLER_REQUIRED');
  const product = await productRepository.findByIdForSeller(user.id, productId, executor);
  if (!product) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
  return product;
}

async function listMyProductImages(user, productId) {
  await assertOwnedProduct(user, productId);
  return imageRepository.listByProductId(productId);
}

async function uploadMyProductImages(user, productId, files) {
  await assertOwnedProduct(user, productId);  const existingCount = await imageRepository.countByProductId(productId);
  if (existingCount + files.length > MAX_IMAGES) throw new AppError('A product can have a maximum of 10 images.', 422, 'PRODUCT_IMAGE_LIMIT');

  const prepared = files.map((file, index) => {
    const extension = assertImageExtension(file.buffer);
    if (!extension) throw new AppError('Image file content is not a supported image.', 422, 'INVALID_PRODUCT_IMAGE_CONTENT');
    const filename = `product-${crypto.randomUUID()}.${extension}`;
    return { filename, file, imageUrl: `${imageUrlPrefix}${filename}`, sortOrder: existingCount + index, isPrimary: existingCount === 0 && index === 0 };
  });

  await fs.mkdir(imageDirectory, { recursive: true });
  const writtenPaths = [];
  try {
    for (const item of prepared) {
      const target = path.join(imageDirectory, item.filename);
      await fs.writeFile(target, item.file.buffer, { flag: 'wx' });
      writtenPaths.push(target);
    }
    await withTransaction(async (connection) => {
      await assertOwnedProduct(user, productId, connection);
      await imageRepository.createMany(productId, prepared, connection);
    });
  } catch (error) {
    await removeFiles(writtenPaths);
    throw error;
  }
  return imageRepository.listByProductId(productId);
}

async function deleteMyProductImage(user, productId, imageId) {
  const image = await assertOwnedProduct(user, productId).then(() => imageRepository.findByIdForProduct(productId, imageId));
  if (!image) throw new AppError('Product image not found.', 404, 'PRODUCT_IMAGE_NOT_FOUND');
  const filePath = path.join(imageDirectory, path.basename(image.imageUrl));
  await withTransaction(async (connection) => {
    await imageRepository.deleteById(productId, imageId, connection);
    if (image.isPrimary) await imageRepository.makeFirstPrimary(productId, connection);
  });
  try { await removeFiles([filePath]); } catch (error) { /* database deletion already succeeded */ }
}

module.exports = { listMyProductImages, uploadMyProductImages, deleteMyProductImage };