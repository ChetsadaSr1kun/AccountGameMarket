const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { pool } = require('../../backend/src/config/database');
const users = require('../../backend/src/repositories/user.repository');
const reviewReports = require('../../backend/src/repositories/review-report.repository');
const transactionReports = require('../../backend/src/repositories/transaction-report.repository');
const { prepareTestDatabase, cleanupTestUsers, closeTestDatabasePool } = require('../helpers/test-database');
const prefix = `reportstorage_${crypto.randomUUID().replaceAll('-', '')}`;
let buyer, seller, orderId, productId, reviewId;
before(async () => {
  await prepareTestDatabase();
  const make = (label, accountMode) => users.create(pool, { email: `${prefix}_${label}@example.test`,
    username: label + prefix.slice(-20), firstName: 'Report', lastName: 'Fixture', phone: null,
    dateOfBirth: '2000-01-01', passwordHash: 'test-only', accountMode });
  buyer = await make('buyer', 'CUSTOMER_ONLY');
  seller = await make('seller', 'SELLER_ONLY');
  const [[game]] = await pool.query('SELECT id FROM games ORDER BY id LIMIT 1');
  const [product] = await pool.execute("INSERT INTO products(seller_id,game_id,title,description,price,status) VALUES (?,?,'fixture','fixture',100,'SOLD')", [seller, game.id]);
  productId = product.insertId;
  const [order] = await pool.execute("INSERT INTO orders(product_id,buyer_id,seller_id,amount,status) VALUES (?,?,?,100,'COMPLETED')", [productId, buyer, seller]);
  orderId = order.insertId;
  const [review] = await pool.execute('INSERT INTO reviews(order_id,product_id,buyer_id,seller_id,rating) VALUES (?,?,?,?,5)', [orderId, productId, buyer, seller]);
  reviewId = review.insertId;
});
after(async () => {
  await pool.execute('DELETE FROM reports WHERE review_id=? OR order_id=?', [reviewId, orderId]);
  await pool.execute('DELETE FROM orders WHERE id=?', [orderId]);
  await pool.execute('DELETE FROM products WHERE id=?', [productId]);
  await cleanupTestUsers(prefix);
  await closeTestDatabasePool();
});

test('colliding legacy report IDs stay separate for lookups, updates and duplicate prevention', async () => {
  const review = await reviewReports.create({ reviewId, reporterId: seller, reason: 'OTHER' });
  const transaction = await transactionReports.create({ orderId, reporterId: buyer, reportedId: seller, reason: 'OTHER' });
  await pool.execute("UPDATE reports SET source_report_id=? WHERE report_type='TRANSACTION' AND id=?", [review.id, transaction.id]);
  const resolved = await transactionReports.updateStatus(review.id, 'RESOLVED', 'NO_VIOLATION', buyer, 'fixture');
  assert.equal(resolved.order_id, orderId);
  assert.equal(resolved.status, 'RESOLVED');
  assert.equal((await reviewReports.getById(review.id)).status, 'PENDING');
  await reviewReports.updateStatus(review.id, 'REVIEWED', buyer, 'fixture');
  assert.equal((await transactionReports.findById(review.id)).status, 'RESOLVED');
  await assert.rejects(reviewReports.create({ reviewId, reporterId: seller, reason: 'OTHER' }), { code: 'ER_DUP_ENTRY' });
  await assert.rejects(transactionReports.create({ orderId, reporterId: buyer, reportedId: seller, reason: 'OTHER' }), { code: 'ER_DUP_ENTRY' });
  assert.ok(!Object.hasOwn(resolved, 'source_report_id'));
  assert.ok(!Object.hasOwn(resolved, 'report_type'));
});

test('database rejects a report whose type does not match its explicit target', async () => {
  await assert.rejects(pool.execute("INSERT INTO reports(report_type,order_id,reporter_id,reason) VALUES ('REVIEW',?,?,'OTHER')", [orderId, seller]),
    (error) => error.errno === 4025 && error.message.includes('chk_reports_target'));
});
