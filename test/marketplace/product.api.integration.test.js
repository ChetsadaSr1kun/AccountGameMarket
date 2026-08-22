const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const { pool } = require('../../backend/src/config/database');
const { hashPassword } = require('../../backend/src/utils/password');
const { prepareTestDatabase, closeTestDatabasePool, assertTestDatabase } = require('../helpers/test-database');
const app = require('../../backend/src/app');

assertTestDatabase();
const api = request(app);
const runId = crypto.randomUUID().replaceAll('-', '');
const sellerEmail = `product_seller_${runId}@example.test`;
const buyerEmail = `product_buyer_${runId}@example.test`;
const sellerBEmail = `product_seller_b_${runId}@example.test`;

function payloadFor(label) {
  return {
    email: `${label}_${runId}@example.test`,
    username: `${label}_${runId.slice(0, 18)}`,
    password: 'TestPassword123',
    firstName: 'Product',
    lastName: 'Tester',
    phone: '0812345678',
    dateOfBirth: '2000-01-01',
    accountType: 'SELLER',
  };
}

function cookiesFrom(response) { return response.headers['set-cookie'] || []; }
function cookieHeader(cookies) { return cookies.map((value) => value.split(';', 1)[0]).join('; '); }

async function register(label, overrides = {}) {
  const payload = { ...payloadFor(label), ...overrides };
  const response = await api.post('/api/v1/auth/register').send(payload);
  assert.equal(response.status, 201);
  return { payload, cookies: cookiesFrom(response) };
}

async function createUserDirect(email, username, accountMode = 'SELLER_ONLY') {
  const passwordHash = await hashPassword('TestPassword123');
  const [result] = await pool.execute(
    `INSERT INTO users (email, username, password_hash, account_mode, first_name, last_name, phone, date_of_birth)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [email, username, passwordHash, accountMode, 'Direct', 'User', '0812345678', '2000-01-01'],
  );
  const [roles] = await pool.execute('SELECT id FROM roles WHERE code = ?', [accountMode === 'SELLER_ONLY' ? 'SELLER' : 'CUSTOMER']);
  await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [result.insertId, roles[0].id]);
  return result.insertId;
}

async function cleanup() {
  const patterns = [sellerEmail, buyerEmail, sellerBEmail, `%_product_${runId}@example.test`, `%_${runId.slice(0, 18)}`];
  for (const pattern of patterns) {
    await pool.execute(
      `DELETE user_roles FROM user_roles INNER JOIN users ON users.id = user_roles.user_id WHERE users.email = ? OR users.email LIKE ?`,
      [pattern, pattern],
    );
    await pool.execute('DELETE FROM users WHERE email = ? OR email LIKE ?', [pattern, pattern]);
  }
}

let sellerCookies;
let sellerBCookies;
let sellerProductId;

before(async () => {
  await prepareTestDatabase();
  await cleanup();
  const seller = await register('seller');
  const sellerB = await register('seller_b');
  sellerCookies = seller.cookies;
  sellerBCookies = sellerB.cookies;
});

after(async () => {
  await cleanup();
  await closeTestDatabasePool();
});

test('rejects product list without authentication', async () => {
  const response = await api.get('/api/v1/user/products');
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'UNAUTHENTICATED');
});

test('creates a draft product for the authenticated seller', async () => {
  const gameResponse = await api.get('/api/v1/games');
  const valorant = gameResponse.body.data.find((game) => game.slug === 'valorant');
  const attributesResponse = await api.get(`/api/v1/games/${valorant.id}/attributes`);
  const attributes = attributesResponse.body.data;
  const rank = attributes.find((attribute) => attribute.slug === 'rank');
  const level = attributes.find((attribute) => attribute.slug === 'account-level');
  const immortal = rank.options.find((option) => option.value === 'immortal');

  const response = await api
    .post('/api/v1/user/products')
    .set('Cookie', cookieHeader(sellerCookies))
    .send({
      gameId: valorant.id,
      title: 'Test Valorant Account',
      description: 'Product API integration test',
      price: 1500,
      status: 'DRAFT',
      attributes: [
        { attributeId: rank.id, optionId: immortal.id },
        { attributeId: level.id, valueNumber: 230 },
      ],
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.title, 'Test Valorant Account');
  assert.equal(response.body.data.status, 'DRAFT');
  sellerProductId = response.body.data.id;
});

test('lists only products owned by the authenticated seller', async () => {
  const response = await api
    .get('/api/v1/user/products')
    .set('Cookie', cookieHeader(sellerCookies));
  assert.equal(response.status, 200);
  assert.ok(response.body.data.some((product) => product.id === sellerProductId));
  assert.ok(response.body.data.every((product) => product.sellerId === response.body.data[0].sellerId));
});

test('prevents one seller from reading another seller product', async () => {
  const response = await api
    .get(`/api/v1/user/products/${sellerProductId}`)
    .set('Cookie', cookieHeader(sellerBCookies));
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'PRODUCT_NOT_FOUND');
});

test('rejects a product when attribute does not belong to selected game', async () => {
  const valorant = (await api.get('/api/v1/games')).body.data.find((game) => game.slug === 'valorant');
  const genshin = (await api.get('/api/v1/games')).body.data.find((game) => game.slug === 'genshin-impact');
  const genshinAttributes = (await api.get(`/api/v1/games/${genshin.id}/attributes`)).body.data;
  const adventureRank = genshinAttributes.find((attribute) => attribute.slug === 'adventure-rank');

  const response = await api
    .post('/api/v1/user/products')
    .set('Cookie', cookieHeader(sellerCookies))
    .send({
      gameId: valorant.id,
      title: 'Invalid Attribute Product',
      description: 'Should fail',
      price: 100,
      status: 'DRAFT',
      attributes: [{ attributeId: adventureRank.id, valueNumber: 60 }],
    });

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'INVALID_ATTRIBUTES');
});

test('rejects a SELECT option that does not belong to its attribute', async () => {
  const games = (await api.get('/api/v1/games')).body.data;
  const valorant = games.find((game) => game.slug === 'valorant');
  const attrs = (await api.get(`/api/v1/games/${valorant.id}/attributes`)).body.data;
  const rank = attrs.find((attribute) => attribute.slug === 'rank');
  const region = attrs.find((attribute) => attribute.slug === 'region');
  const asia = region.options.find((option) => option.value === 'asia');

  const response = await api
    .post('/api/v1/user/products')
    .set('Cookie', cookieHeader(sellerCookies))
    .send({
      gameId: valorant.id,
      title: 'Invalid Option Product',
      description: 'Should fail',
      price: 100,
      attributes: [{ attributeId: rank.id, optionId: asia.id }],
    });

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'INVALID_ATTRIBUTES');
});

test('updates a product owned by the seller', async () => {
  const response = await api
    .patch(`/api/v1/user/products/${sellerProductId}`)
    .set('Cookie', cookieHeader(sellerCookies))
    .send({ title: 'Updated Valorant Account', price: 1750 });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.title, 'Updated Valorant Account');
  assert.equal(Number(response.body.data.price), 1750);
});

test('prevents one seller from updating another seller product', async () => {
  const response = await api
    .patch(`/api/v1/user/products/${sellerProductId}`)
    .set('Cookie', cookieHeader(sellerBCookies))
    .send({ title: 'Hijacked' });
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'PRODUCT_NOT_FOUND');
});

test('prevents one seller from deleting another seller product', async () => {
  const response = await api
    .delete(`/api/v1/user/products/${sellerProductId}`)
    .set('Cookie', cookieHeader(sellerBCookies));
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'PRODUCT_NOT_FOUND');
});

test('deletes a product owned by the seller', async () => {
  const response = await api
    .delete(`/api/v1/user/products/${sellerProductId}`)
    .set('Cookie', cookieHeader(sellerCookies));
  assert.equal(response.status, 204);

  const check = await api
    .get(`/api/v1/user/products/${sellerProductId}`)
    .set('Cookie', cookieHeader(sellerCookies));
  assert.equal(check.status, 404);
});
