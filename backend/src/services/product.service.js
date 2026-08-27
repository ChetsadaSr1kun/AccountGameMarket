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

function normalizeAttributes(attributes = []) {
  const ids = attributes.map((item) => item.attributeId);
  if (new Set(ids).size !== ids.length) throw new AppError('Duplicate attribute values are not allowed.', 422, 'INVALID_ATTRIBUTES');
  return attributes.map((item) => ({ attributeId: item.attributeId, optionId: item.optionId, text: item.valueText, number: item.valueNumber, boolean: item.valueBoolean }));
}

async function validateAttributes(gameId, attributes, executor) {
  const normalized = normalizeAttributes(attributes);
  const attributeIds = normalized.map((item) => item.attributeId);
  const dbAttributes = await productRepository.findAttributesByIds(attributeIds, gameId, executor);
  if (dbAttributes.length !== attributeIds.length || dbAttributes.some((item) => item.status !== 'ACTIVE')) throw new AppError('One or more attributes do not belong to this active game.', 422, 'INVALID_ATTRIBUTES');
  const byId = new Map(dbAttributes.map((item) => [item.id, item]));
  const optionIds = normalized.filter((item) => item.optionId).map((item) => item.optionId);
  const options = await productRepository.findOptionsByIds(optionIds, attributeIds, executor);
  const optionsById = new Map(options.map((item) => [item.id, item]));
  for (const value of normalized) {
    const attribute = byId.get(value.attributeId);
    const supplied = [value.optionId !== undefined, value.text !== undefined, value.number !== undefined, value.boolean !== undefined].filter(Boolean).length;
    if (supplied !== 1) throw new AppError('Each attribute must contain exactly one value.', 422, 'INVALID_ATTRIBUTES');
    if (attribute.type === 'SELECT') {
      const option = optionsById.get(value.optionId);
      if (!option || option.game_attribute_id !== attribute.id || option.status !== 'ACTIVE') throw new AppError('Invalid attribute option.', 422, 'INVALID_ATTRIBUTES');
    } else if (value.optionId !== undefined) throw new AppError('Option values are only valid for SELECT attributes.', 422, 'INVALID_ATTRIBUTES');
    else if (attribute.type === 'TEXT' && value.text === undefined) throw new AppError('TEXT attribute requires valueText.', 422, 'INVALID_ATTRIBUTES');
    else if (attribute.type === 'NUMBER' && value.number === undefined) throw new AppError('NUMBER attribute requires valueNumber.', 422, 'INVALID_ATTRIBUTES');
    else if (attribute.type === 'BOOLEAN' && value.boolean === undefined) throw new AppError('BOOLEAN attribute requires valueBoolean.', 422, 'INVALID_ATTRIBUTES');
  }
  return { normalized };
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
  product.attributes = await productRepository.listAttributeValues(productId);
  product.credentials = await loadCredentials(productId, require('../config/database').pool);
  return product;
}

async function createMyProduct(user, data) {
  assertSeller(user);
  return withTransaction(async (connection) => {
    await assertGame(data.gameId, connection);
    const { normalized } = await validateAttributes(data.gameId, data.attributes, connection);
    const productId = await productRepository.create({ sellerId: user.id, ...data, status: data.status || 'DRAFT' }, connection);
    await productRepository.replaceAttributeValues(productId, normalized, connection);
    if (data.credentials) await productCredentialRepository.upsert(productId, encryptCredentials(data.credentials), connection);
    const product = await productRepository.findByIdForSeller(user.id, productId, connection);
    product.attributes = await productRepository.listAttributeValues(productId, connection);
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
    if (data.attributes) {
      const { normalized } = await validateAttributes(existing.gameId, data.attributes, connection);
      await productRepository.replaceAttributeValues(productId, normalized, connection);
    }
    const fields = {};
    if (data.title !== undefined) fields.title = data.title;
    if (data.description !== undefined) fields.description = data.description;
    if (data.price !== undefined) fields.price = data.price;
    if (data.status !== undefined) fields.status = data.status;
    await productRepository.update(productId, user.id, fields, connection);
    if (data.credentials) await productCredentialRepository.upsert(productId, encryptCredentials(data.credentials), connection);
    const product = await productRepository.findByIdForSeller(user.id, productId, connection);
    product.attributes = await productRepository.listAttributeValues(productId, connection);
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
