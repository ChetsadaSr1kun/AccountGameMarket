const assert = require('node:assert/strict');
const crypto = require('crypto');
const { test, before, after } = require('node:test');
const { pool } = require('../../backend/src/config/database');
const userRepository = require('../../backend/src/repositories/user.repository');
const { prepareTestDatabase, closeTestDatabasePool, assertTestDatabase } = require('../helpers/test-database');

assertTestDatabase();
const runId = crypto.randomUUID().replaceAll('-', '');
const sellerEmail = `marketplace_test_${runId}@example.test`;
const sellerUsername = `mk_${runId.slice(0, 20)}`;

async function findGame(slug) {
  const [rows] = await pool.execute('SELECT id FROM games WHERE slug = ? LIMIT 1', [slug]);
  assert.equal(rows.length, 1, `Expected seeded game: ${slug}`);
  return rows[0].id;
}

let sellerId = null;

async function createSeller() {
  if (sellerId) return sellerId;
  sellerId = await userRepository.create(pool, {
    email: sellerEmail,
    username: sellerUsername,
    firstName: 'Marketplace',
    lastName: 'Seller',
    phone: '0812345678',
    dateOfBirth: '2000-01-01',
    passwordHash: 'test-hash',
    accountMode: 'SELLER_ONLY',
  });
  return sellerId;
}

async function cleanupSeller() {
  const [users] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [sellerEmail]);
  if (!users.length) return;
  const sellerId = users[0].id;
  await pool.execute('DELETE FROM products WHERE seller_id = ?', [sellerId]);
  await pool.execute('DELETE FROM user_roles WHERE user_id = ?', [sellerId]);
  await pool.execute('DELETE FROM users WHERE id = ?', [sellerId]);
}

before(async () => {
  await prepareTestDatabase();
  await cleanupSeller();
});

after(async () => {
  await cleanupSeller();
  await closeTestDatabasePool();
});

test('seeds the initial six-game catalog with active status', async () => {
  const [rows] = await pool.execute('SELECT slug, status FROM games ORDER BY id');
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map((row) => row.slug), [
    'valorant', 'rov', 'pubg', 'free-fire', 'genshin-impact', 'honkai-star-rail',
  ]);
  assert.ok(rows.every((row) => row.status === 'ACTIVE'));
});

test('seeds game attributes and options consistently', async () => {
  const [[attributeCount]] = await pool.query('SELECT COUNT(*) AS count FROM game_attributes');
  const [[optionCount]] = await pool.query('SELECT COUNT(*) AS count FROM game_attribute_options');
  assert.equal(Number(attributeCount.count), 38);
  assert.equal(Number(optionCount.count), 69);

  const [selectWithoutOptions] = await pool.query(`
    SELECT ga.id
    FROM game_attributes ga
    LEFT JOIN game_attribute_options gao
      ON gao.game_attribute_id = ga.id AND gao.status = 'ACTIVE'
    WHERE ga.type = 'SELECT' AND ga.status = 'ACTIVE'
    GROUP BY ga.id
    HAVING COUNT(gao.id) = 0
  `);
  assert.equal(selectWithoutOptions.length, 0);
});

test('creates a product and its related marketplace records', async () => {
  const sellerId = await createSeller();
  const gameId = await findGame('valorant');
  const [[rank]] = await pool.query(
    "SELECT id FROM game_attributes WHERE game_id = ? AND slug = 'rank' LIMIT 1",
    [gameId],
  );
  const [[immortal]] = await pool.query(
    "SELECT id FROM game_attribute_options WHERE game_attribute_id = ? AND value = 'immortal' LIMIT 1",
    [rank.id],
  );

  const [productResult] = await pool.execute(
    `INSERT INTO products (seller_id, game_id, title, description, price, status)
     VALUES (?, ?, ?, ?, ?, 'DRAFT')`,
    [sellerId, gameId, 'Test Valorant Account', 'Foundation integration test product', 1500],
  );
  const productId = productResult.insertId;

  await pool.execute(
    `INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
     VALUES (?, ?, 0, TRUE)`,
    [productId, '/uploads/products/test.jpg'],
  );
  await pool.execute(
    `INSERT INTO product_attribute_values (product_id, game_attribute_id, game_attribute_option_id)
     VALUES (?, ?, ?)`,
    [productId, rank.id, immortal.id],
  );
  await pool.execute(
    `INSERT INTO product_attribute_values (product_id, game_attribute_id, value_number)
     SELECT ?, id, ? FROM game_attributes
     WHERE game_id = ? AND slug = 'account-level'`,
    [productId, 230, gameId],
  );
  await pool.execute(
    'INSERT INTO product_credentials (product_id, game_username_encrypted) VALUES (?, ?)',
    [productId, 'encrypted-test-username'],
  );

  const [[product]] = await pool.query(
    'SELECT seller_id, game_id, price, status FROM products WHERE id = ?',
    [productId],
  );
  assert.equal(product.seller_id, sellerId);
  assert.equal(product.game_id, gameId);
  assert.equal(Number(product.price), 1500);
  assert.equal(product.status, 'DRAFT');

  const [[imageCount]] = await pool.query(
    'SELECT COUNT(*) AS count FROM product_images WHERE product_id = ?',
    [productId],
  );
  const [[attributeValueCount]] = await pool.query(
    'SELECT COUNT(*) AS count FROM product_attribute_values WHERE product_id = ?',
    [productId],
  );
  const [[credentialCount]] = await pool.query(
    'SELECT COUNT(*) AS count FROM product_credentials WHERE product_id = ?',
    [productId],
  );
  assert.equal(Number(imageCount.count), 1);
  assert.equal(Number(attributeValueCount.count), 2);
  assert.equal(Number(credentialCount.count), 1);
});

test('cascades product child records and keeps the game record', async () => {
  const sellerId = await createSeller();
  const gameId = await findGame('genshin-impact');
  const [result] = await pool.execute(
    `INSERT INTO products (seller_id, game_id, title, description, price)
     VALUES (?, ?, ?, ?, ?)`,
    [sellerId, gameId, 'Cascade Test', 'Cascade test', 99],
  );
  const productId = result.insertId;

  await pool.execute(
    'INSERT INTO product_images (product_id, image_url) VALUES (?, ?)',
    [productId, '/uploads/products/cascade.jpg'],
  );
  await pool.execute(
    'INSERT INTO product_credentials (product_id, game_username_encrypted) VALUES (?, ?)',
    [productId, 'x'],
  );
  await pool.execute('DELETE FROM products WHERE id = ?', [productId]);

  const [[images]] = await pool.query(
    'SELECT COUNT(*) AS count FROM product_images WHERE product_id = ?',
    [productId],
  );
  const [[credentials]] = await pool.query(
    'SELECT COUNT(*) AS count FROM product_credentials WHERE product_id = ?',
    [productId],
  );
  const [[game]] = await pool.query('SELECT COUNT(*) AS count FROM games WHERE id = ?', [gameId]);
  assert.equal(Number(images.count), 0);
  assert.equal(Number(credentials.count), 0);
  assert.equal(Number(game.count), 1);
});

test('prevents deleting a game that is referenced by products', async () => {
  const sellerId = await createSeller();
  const gameId = await findGame('pubg');
  const [result] = await pool.execute(
    `INSERT INTO products (seller_id, game_id, title, description, price)
     VALUES (?, ?, ?, ?, ?)`,
    [sellerId, gameId, 'FK Test', 'Foreign key test', 10],
  );

  await assert.rejects(
    pool.execute('DELETE FROM games WHERE id = ?', [gameId]),
    (error) => error && ['ER_ROW_IS_REFERENCED_2', 'ER_ROW_IS_REFERENCED'].includes(error.code),
  );

  await pool.execute('DELETE FROM products WHERE id = ?', [result.insertId]);
});
