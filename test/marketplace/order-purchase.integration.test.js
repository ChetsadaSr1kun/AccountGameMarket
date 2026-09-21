'use strict';

const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');

const app = require('../../backend/src/app');
const { pool } = require('../../backend/src/config/database');
const userRepository = require('../../backend/src/repositories/user.repository');
const roleRepository = require('../../backend/src/repositories/role.repository');
const { encrypt } = require('../../backend/src/utils/credential-crypto');
const { hashPassword } = require('../../backend/src/utils/password');
const {
  cleanupTestUsers,
  closeTestDatabasePool,
  prepareTestDatabase,
} = require('../helpers/test-database');

if (process.env.NODE_ENV !== 'test' || process.env.DB_NAME !== 'gamemarket_test') {
  throw new Error('Order-purchase tests are locked to the gamemarket_test database.');
}

const api = request(app);
const runId = crypto.randomUUID().replaceAll('-', '');
const emailPrefix = `orderpurchase_${runId}_`;
const password = 'TestPassword123';
const productPrice = 250;
const buyerStartingBalance = 1000;
const sellerStartingBalance = 100;
const productTitle = `Audit marketplace product ${runId.slice(0, 10)}`;
const productDescription = 'Public marketplace and wallet purchase fixture.';
const primaryImageUrl = `/uploads/products/order-purchase-${runId}.png`;
const fixtureCredentials = {
  gameUsername: `fixture-user-${runId.slice(0, 8)}`,
  gamePassword: `FixturePassword-${runId.slice(0, 8)}`,
  email: `credential-${runId.slice(0, 8)}@example.test`,
  emailPassword: `FixtureEmailPassword-${runId.slice(0, 8)}`,
};

let phoneSequence = 0;
let seller;
let buyer;
let unrelatedUser;
let productId;
let orderId;
let attributeId;

function cookieHeader(response) {
  return (response.headers['set-cookie'] || [])
    .map((value) => value.split(';', 1)[0])
    .join('; ');
}

function csrfToken(response) {
  const cookie = (response.headers['set-cookie'] || [])
    .find((value) => value.startsWith('gm_csrf='));
  return cookie?.split(';', 1)[0].slice('gm_csrf='.length);
}

function nextPhone() {
  const base = Number.parseInt(runId.slice(0, 7), 16) % 100000000;
  const value = (base + phoneSequence++) % 100000000;
  return `08${String(value).padStart(8, '0')}`;
}

async function createVerifiedUser(label, roles, accountMode) {
  const username = `op_${runId.slice(0, 13)}_${label}`;
  const userId = await userRepository.create(pool, {
    email: `${emailPrefix}${label}@example.test`,
    username,
    firstName: 'Order',
    lastName: 'Fixture',
    phone: nextPhone(),
    dateOfBirth: '2000-01-01',
    passwordHash: await hashPassword(password),
    accountMode,
  });
  const roleIds = await roleRepository.findIdsByCodes(pool, roles);
  assert.equal(roleIds.length, roles.length);
  await userRepository.assignRoles(pool, userId, roleIds);
  await userRepository.markEmailVerified(pool, userId);
  await userRepository.markPhoneVerified(pool, userId);

  const auth = await api.post('/api/v1/auth/login').send({ username, password });
  assert.equal(auth.status, 200);
  assert.equal(auth.body.data.user.accountVerified, true);
  return { id: Number(userId), username, auth };
}

async function walletBalance(userId) {
  const [[wallet]] = await pool.execute('SELECT balance FROM wallets WHERE user_id = ?', [userId]);
  return Number(wallet.balance);
}

async function ledgerRows(userId, type) {
  const [rows] = await pool.execute(
    `SELECT type, amount, balance_after, reference_type, reference_id
       FROM wallet_transactions
      WHERE wallet_user_id = ? AND type = ? AND reference_type = 'ORDER' AND reference_id = ?
      ORDER BY id`,
    [userId, type, orderId],
  );
  return rows;
}

async function notificationCount(userId, type) {
  const [[row]] = await pool.execute(
    `SELECT COUNT(*) AS count FROM notifications
      WHERE user_id = ? AND type = ? AND reference_type = 'ORDER' AND reference_id = ?`,
    [userId, type, orderId],
  );
  return Number(row.count);
}

async function cleanupFixtures() {
  const [users] = await pool.execute('SELECT id FROM users WHERE email LIKE ?', [`${emailPrefix}%`]);
  const userIds = users.map(({ id }) => Number(id));

  if (userIds.length > 0) {
    const placeholders = userIds.map(() => '?').join(', ');
    await pool.execute(`DELETE FROM notifications WHERE user_id IN (${placeholders})`, userIds);
    await pool.execute(`DELETE FROM wallet_transactions WHERE wallet_user_id IN (${placeholders})`, userIds);
  }
  if (orderId) await pool.execute('DELETE FROM orders WHERE id = ?', [orderId]);
  if (productId) {
    await pool.execute('DELETE FROM product_attribute_values WHERE product_id = ?', [productId]);
    await pool.execute('DELETE FROM product_images WHERE product_id = ?', [productId]);
    await pool.execute('DELETE FROM product_credentials WHERE product_id = ?', [productId]);
    await pool.execute('DELETE FROM products WHERE id = ?', [productId]);
  }
  if (userIds.length > 0) {
    const placeholders = userIds.map(() => '?').join(', ');
    await pool.execute(`DELETE FROM wallets WHERE user_id IN (${placeholders})`, userIds);
  }
  await cleanupTestUsers(emailPrefix);
}

before(async () => {
  await prepareTestDatabase();
  await cleanupFixtures();

  seller = await createVerifiedUser('seller', ['SELLER'], 'SELLER_ONLY');
  buyer = await createVerifiedUser('buyer', ['CUSTOMER'], 'CUSTOMER_ONLY');
  unrelatedUser = await createVerifiedUser('unrelated', ['CUSTOMER'], 'CUSTOMER_ONLY');

  const [[game]] = await pool.execute("SELECT id FROM games WHERE slug = 'valorant' AND status = 'ACTIVE' LIMIT 1");
  assert.ok(game);
  const [[attribute]] = await pool.execute(
    "SELECT id FROM game_attributes WHERE game_id = ? AND slug = 'account-level' AND status = 'ACTIVE' LIMIT 1",
    [game.id],
  );
  assert.ok(attribute);
  attributeId = Number(attribute.id);

  const [product] = await pool.execute(
    `INSERT INTO products (seller_id, game_id, title, description, price, status)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
    [seller.id, game.id, productTitle, productDescription, productPrice],
  );
  productId = Number(product.insertId);
  await pool.execute(
    'INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (?, ?, 0, TRUE)',
    [productId, primaryImageUrl],
  );
  await pool.execute(
    'INSERT INTO product_attribute_values (product_id, game_attribute_id, value_number) VALUES (?, ?, ?)',
    [productId, attributeId, 75],
  );
  await pool.execute(
    `INSERT INTO product_credentials
       (product_id, game_username_encrypted, game_password_encrypted, email_encrypted, email_password_encrypted)
     VALUES (?, ?, ?, ?, ?)`,
    [
      productId,
      encrypt(fixtureCredentials.gameUsername),
      encrypt(fixtureCredentials.gamePassword),
      encrypt(fixtureCredentials.email),
      encrypt(fixtureCredentials.emailPassword),
    ],
  );

  await pool.execute('INSERT INTO wallets (user_id, balance) VALUES (?, ?), (?, ?)', [
    buyer.id,
    buyerStartingBalance,
    seller.id,
    sellerStartingBalance,
  ]);
});

after(async () => {
  await cleanupFixtures();
  await closeTestDatabasePool();
});

test('lists an active marketplace product and returns its public detail without credentials', async () => {
  const listing = await api.get('/api/v1/products').query({ search: productTitle, pageSize: 10 });
  assert.equal(listing.status, 200);
  const listedProduct = listing.body.data.items.find((item) => Number(item.id) === productId);
  assert.ok(listedProduct);
  assert.equal(listedProduct.title, productTitle);
  assert.equal(listedProduct.description, productDescription);
  assert.equal(listedProduct.price, productPrice);
  assert.equal(listedProduct.status, 'ACTIVE');
  assert.equal(Number(listedProduct.seller.id), seller.id);
  assert.equal(listedProduct.seller.username, seller.username);
  assert.equal(listedProduct.primaryImageUrl, primaryImageUrl);
  assert.equal(Object.hasOwn(listedProduct, 'credentials'), false);

  const detail = await api.get(`/api/v1/products/${productId}`);
  assert.equal(detail.status, 200);
  assert.equal(Number(detail.body.data.id), productId);
  assert.equal(detail.body.data.title, productTitle);
  assert.equal(detail.body.data.description, productDescription);
  assert.equal(detail.body.data.price, productPrice);
  assert.equal(detail.body.data.status, 'ACTIVE');
  assert.equal(Number(detail.body.data.seller.id), seller.id);
  assert.equal(detail.body.data.seller.username, seller.username);
  assert.equal(detail.body.data.images.length, 1);
  assert.equal(detail.body.data.images[0].imageUrl, primaryImageUrl);
  assert.equal(detail.body.data.images[0].isPrimary, true);
  const publicAttribute = detail.body.data.attributes.find((item) => Number(item.attributeId) === attributeId);
  assert.ok(publicAttribute);
  assert.equal(Number(publicAttribute.valueNumber), 75);
  assert.equal(Object.hasOwn(detail.body.data, 'credentials'), false);
});

test('settles a verified buyer wallet purchase exactly once', async () => {
  assert.equal(await walletBalance(buyer.id), buyerStartingBalance);
  assert.equal(await walletBalance(seller.id), sellerStartingBalance);

  const created = await api
    .post('/api/v1/orders')
    .set('Cookie', cookieHeader(buyer.auth))
    .set('X-CSRF-Token', csrfToken(buyer.auth))
    .send({ productId });
  assert.equal(created.status, 201);
  orderId = Number(created.body.data.order.id);
  assert.ok(orderId > 0);
  assert.equal(created.body.data.order.status, 'PENDING');
  assert.equal(created.body.data.order.amount, productPrice);
  assert.equal(await walletBalance(buyer.id), buyerStartingBalance);
  assert.equal(await walletBalance(seller.id), sellerStartingBalance);
  assert.equal((await ledgerRows(buyer.id, 'PURCHASE')).length, 0);
  assert.equal((await ledgerRows(seller.id, 'SALE')).length, 0);

  const [[pendingProduct]] = await pool.execute('SELECT status FROM products WHERE id = ?', [productId]);
  assert.equal(pendingProduct.status, 'ACTIVE');
  const credentialsBeforePayment = await api
    .get(`/api/v1/orders/${orderId}/credentials`)
    .set('Cookie', cookieHeader(buyer.auth));
  assert.equal(credentialsBeforePayment.status, 403);
  assert.equal(credentialsBeforePayment.body.error.code, 'ORDER_NOT_PAID');

  const paid = await api
    .post(`/api/v1/orders/${orderId}/pay`)
    .set('Cookie', cookieHeader(buyer.auth))
    .set('X-CSRF-Token', csrfToken(buyer.auth));
  assert.equal(paid.status, 200);
  assert.equal(paid.body.data.order.status, 'COMPLETED');

  const [[settledOrder]] = await pool.execute(
    'SELECT status, amount, completed_at FROM orders WHERE id = ?',
    [orderId],
  );
  assert.equal(settledOrder.status, 'COMPLETED');
  assert.equal(Number(settledOrder.amount), productPrice);
  assert.ok(settledOrder.completed_at);
  const [[soldProduct]] = await pool.execute('SELECT status FROM products WHERE id = ?', [productId]);
  assert.equal(soldProduct.status, 'SOLD');

  assert.equal(await walletBalance(buyer.id), buyerStartingBalance - productPrice);
  assert.equal(await walletBalance(seller.id), sellerStartingBalance + productPrice);
  const purchases = await ledgerRows(buyer.id, 'PURCHASE');
  const sales = await ledgerRows(seller.id, 'SALE');
  assert.equal(purchases.length, 1);
  assert.equal(Number(purchases[0].amount), productPrice);
  assert.equal(Number(purchases[0].balance_after), buyerStartingBalance - productPrice);
  assert.equal(sales.length, 1);
  assert.equal(Number(sales[0].amount), productPrice);
  assert.equal(Number(sales[0].balance_after), sellerStartingBalance + productPrice);
  assert.equal(await notificationCount(buyer.id, 'ORDER_PURCHASE'), 1);
  assert.equal(await notificationCount(seller.id, 'ORDER_SOLD'), 1);

  const duplicatePayment = await api
    .post(`/api/v1/orders/${orderId}/pay`)
    .set('Cookie', cookieHeader(buyer.auth))
    .set('X-CSRF-Token', csrfToken(buyer.auth));
  assert.equal(duplicatePayment.status, 409);
  assert.equal(duplicatePayment.body.error.code, 'ORDER_NOT_PAYABLE');
  assert.equal(await walletBalance(buyer.id), buyerStartingBalance - productPrice);
  assert.equal(await walletBalance(seller.id), sellerStartingBalance + productPrice);
  assert.equal((await ledgerRows(buyer.id, 'PURCHASE')).length, 1);
  assert.equal((await ledgerRows(seller.id, 'SALE')).length, 1);
  assert.equal(await notificationCount(buyer.id, 'ORDER_PURCHASE'), 1);
  assert.equal(await notificationCount(seller.id, 'ORDER_SOLD'), 1);
});

test('allows the buyer to read the completed order and credentials while denying an unrelated user', async () => {
  const buyerOrder = await api
    .get(`/api/v1/orders/${orderId}`)
    .set('Cookie', cookieHeader(buyer.auth));
  assert.equal(buyerOrder.status, 200);
  assert.equal(buyerOrder.body.data.order.status, 'COMPLETED');
  assert.equal(Number(buyerOrder.body.data.order.id), orderId);

  const buyerCredentials = await api
    .get(`/api/v1/orders/${orderId}/credentials`)
    .set('Cookie', cookieHeader(buyer.auth));
  assert.equal(buyerCredentials.status, 200);
  assert.deepEqual(buyerCredentials.body.data.credentials, fixtureCredentials);

  const unrelatedOrder = await api
    .get(`/api/v1/orders/${orderId}`)
    .set('Cookie', cookieHeader(unrelatedUser.auth));
  assert.equal(unrelatedOrder.status, 404);
  assert.equal(unrelatedOrder.body.error.code, 'ORDER_NOT_FOUND');

  const unrelatedCredentials = await api
    .get(`/api/v1/orders/${orderId}/credentials`)
    .set('Cookie', cookieHeader(unrelatedUser.auth));
  assert.equal(unrelatedCredentials.status, 404);
  assert.equal(unrelatedCredentials.body.error.code, 'ORDER_NOT_FOUND');

  const soldPublicProduct = await api.get(`/api/v1/products/${productId}`);
  assert.equal(soldPublicProduct.status, 404);
  assert.equal(soldPublicProduct.body.error.code, 'PRODUCT_NOT_FOUND');
});
