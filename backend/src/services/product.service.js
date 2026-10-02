const productRepository = require('../repositories/product.repository');
const productCredentialRepository = require('../repositories/product-credential.repository');
const { encrypt, decrypt } = require('../utils/credential-crypto');
const AppError = require('../utils/app-error');
const { withTransaction } = require('../utils/transaction');

function assertSeller(user) {
  if (!user.roles.includes('SELLER')) throw new AppError('Seller permission is required.', 403, 'SELLER_REQUIRED');
}

function encryptCredentials(credentials) {
  if (!credentials) return null;
  return {
    gameUsernameEncrypted: encrypt(credentials.gameUsername),
    gamePasswordEncrypted: encrypt(credentials.gamePassword),
    emailEncrypted: encrypt(credentials.email),
    emailPasswordEncrypted: encrypt(credentials.emailPassword),
  };
}

function assertActiveCredentials(credentials) {
  const gameUsername = String(credentials?.gameUsername || '').trim();
  const gamePassword = String(credentials?.gamePassword || '');
  if (!gameUsername || !gamePassword) throw new AppError('Active products must include game account credentials.', 422, 'PRODUCT_CREDENTIALS_REQUIRED');
}

async function loadCredentials(productId, executor = require('../config/database').pool) {
  const row = await productCredentialRepository.findByProductId(productId, executor);
  if (!row) return null;
  return {
    gameUsername: decrypt(row.game_username_encrypted),
    gamePassword: decrypt(row.game_password_encrypted),
    email: decrypt(row.email_encrypted),
    emailPassword: decrypt(row.email_password_encrypted),
  };
}

async function assertGame(gameId, executor) {
  const game = await productRepository.findGame(gameId, executor);
  if (!game || game.status !== 'ACTIVE') throw new AppError('Game not found.', 404, 'GAME_NOT_FOUND');
  return game;
}

async function listMyProducts(user) { assertSeller(user); return productRepository.listBySeller(user.id); }

async function getMyProduct(user, productId) {
  assertSeller(user);
  const product = await productRepository.findByIdForSeller(user.id, productId);
  if (!product) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
  product.credentials = await loadCredentials(productId, require('../config/database').pool);
  return product;
}

async function createMyProduct(user, data) {
  assertSeller(user);
  return withTransaction(async (connection) => {
    await assertGame(data.gameId, connection);
    const status = data.status || 'DRAFT';
    if (status === 'ACTIVE') assertActiveCredentials(data.credentials);
    const productId = await productRepository.create({ sellerId: user.id, ...data, status }, connection);
    if (data.credentials) await productCredentialRepository.upsert(productId, encryptCredentials(data.credentials), connection);
    const product = await productRepository.findByIdForSeller(user.id, productId, connection);
    product.credentials = await loadCredentials(productId, connection);
    return product;
  });
}

async function updateMyProduct(user, productId, data) {
  assertSeller(user);
  return withTransaction(async (connection) => {
    const existing = await productRepository.findByIdForSeller(user.id, productId, connection);
    if (!existing) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    if (data.gameId && data.gameId !== existing.gameId) throw new AppError('Changing a product game is not supported.', 422, 'GAME_CHANGE_NOT_ALLOWED');
    const targetStatus = data.status !== undefined ? data.status : existing.status;
    if (targetStatus === 'ACTIVE') {
      if (data.credentials !== undefined) assertActiveCredentials(data.credentials);
      else assertActiveCredentials(await loadCredentials(productId, connection));
    }
    const fields = {};
    if (data.title !== undefined) fields.title = data.title;
    if (data.description !== undefined) fields.description = data.description;
    if (data.price !== undefined) fields.price = data.price;
    if (data.status !== undefined) fields.status = data.status;
    await productRepository.update(productId, user.id, fields, connection);
    if (data.credentials) await productCredentialRepository.upsert(productId, encryptCredentials(data.credentials), connection);
    const product = await productRepository.findByIdForSeller(user.id, productId, connection);
    product.credentials = await loadCredentials(productId, connection);
    return product;
  });
}

async function deleteMyProduct(user, productId) {
  assertSeller(user);
  const deleted = await productRepository.deleteByIdForSeller(productId, user.id);
  if (!deleted) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
}

module.exports = { listMyProducts, getMyProduct, createMyProduct, updateMyProduct, deleteMyProduct, loadCredentials };
