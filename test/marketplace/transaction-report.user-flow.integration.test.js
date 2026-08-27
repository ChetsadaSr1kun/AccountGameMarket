const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const { pool } = require('../../backend/src/config/database');
const app = require('../../backend/src/app');
const { prepareTestDatabase, closeTestDatabasePool } = require('../helpers/test-database');

const api = request(app);
const runId = crypto.randomUUID().replaceAll('-', '');
const buyerEmail = `report_buyer_${runId}@example.test`;
const sellerEmail = `report_seller_${runId}@example.test`;
const otherEmail = `report_other_${runId}@example.test`;
let buyer = null;
let seller = null;
let other = null;
let productId = null;
let orderPaid = null;
let orderPending = null;
let orderCancelled = null;

function cookiesFrom(response) { return response.headers['set-cookie'] || []; }
function cookieHeader(cookies) { return cookies.map((value) => value.split(';', 1)[0]).join('; '); }
function cookieValue(cookies, name) {
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  return cookie ? cookie.split(';', 1)[0].slice(name.length + 1) : null;
}
async function register(email, username) {
  const response = await api.post('/api/v1/auth/register').send({
    email, username, password: 'TestPassword123', firstName: 'Report', lastName: 'Test',
    phone: `08${String(Math.abs(Number.parseInt(crypto.randomBytes(4).toString('hex'), 16)) % 100000000).padStart(8, '0')}`,
    dateOfBirth: '2000-01-01', accountType: 'CUSTOMER',
  });
  assert.equal(response.status, 201);
  return { id: Number(response.body.data.user.id), cookies: cookiesFrom(response) };
}

before(async () => {
  await prepareTestDatabase();
  buyer = await register(buyerEmail, `rptbuyer_${runId.slice(0, 16)}`);
  seller = await register(sellerEmail, `rptseller_${runId.slice(0, 16)}`);
  other = await register(otherEmail, `rptother_${runId.slice(0, 16)}`);
  const [games] = await pool.execute("SELECT id FROM games WHERE slug='genshin-impact' LIMIT 1");
  assert.equal(games.length, 1);
  const [products] = await pool.execute(
    "INSERT INTO products (seller_id,game_id,title,description,price,status) VALUES (?,?,?,?,?,'SOLD')",
    [seller.id, games[0].id, 'Report Flow Test', 'Transaction report integration test', 100],
  );
  productId = products.insertId;
  const [paid] = await pool.execute(
    "INSERT INTO orders (product_id,buyer_id,seller_id,amount,status,completed_at) VALUES (?,?,?,?, 'PAID',NULL)",
    [productId, buyer.id, seller.id, 100],
  );
  orderPaid = paid.insertId;
  const [pending] = await pool.execute(
    "INSERT INTO orders (product_id,buyer_id,seller_id,amount,status) VALUES (?,?,?,?, 'PENDING')",
    [productId, buyer.id, seller.id, 100],
  );
  orderPending = pending.insertId;
  const [cancelled] = await pool.execute(
    "INSERT INTO orders (product_id,buyer_id,seller_id,amount,status) VALUES (?,?,?,?, 'CANCELLED')",
    [productId, buyer.id, seller.id, 100],
  );
  orderCancelled = cancelled.insertId;
});

after(async () => {
  if (orderPaid || orderPending || orderCancelled) {
    await pool.execute('DELETE FROM transaction_reports WHERE order_id IN (?,?,?)', [orderPaid, orderPending, orderCancelled]);
    await pool.execute('DELETE FROM orders WHERE id IN (?,?,?)', [orderPaid, orderPending, orderCancelled]);
  }
  if (productId) await pool.execute('DELETE FROM products WHERE id=?', [productId]);
  for (const email of [buyerEmail, sellerEmail, otherEmail]) {
    await pool.execute('DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email=?)', [email]);
    await pool.execute('DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE email=?)', [email]);
    await pool.execute('DELETE FROM user_verification_otps WHERE user_id IN (SELECT id FROM users WHERE email=?)', [email]);
    await pool.execute('DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email=?)', [email]);
    await pool.execute('DELETE FROM users WHERE email=?', [email]);
  }
  await closeTestDatabasePool();
});

test('allows a completed/paid participant to create a transaction report', async () => {
  const csrf = cookieValue(buyer.cookies, 'gm_csrf');
  const response = await api.post('/api/v1/transaction-reports')
    .set('Cookie', cookieHeader(buyer.cookies)).set('X-CSRF-Token', csrf)
    .send({ orderId: orderPaid, reason: 'NO_DELIVERY', description: 'ยังไม่ได้รับข้อมูลบัญชี' });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.report.reporterId, buyer.id);
  assert.equal(response.body.data.report.reportedId, seller.id);
  assert.equal(response.body.data.report.status, 'PENDING');
});

test('prevents the same participant from reporting the same order twice', async () => {
  const csrf = cookieValue(buyer.cookies, 'gm_csrf');
  const response = await api.post('/api/v1/transaction-reports')
    .set('Cookie', cookieHeader(buyer.cookies)).set('X-CSRF-Token', csrf)
    .send({ orderId: orderPaid, reason: 'SCAM' });
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'REPORT_ALREADY_EXISTS');
});

test('allows the seller to report the same transaction once as the other participant', async () => {
  const csrf = cookieValue(seller.cookies, 'gm_csrf');
  const response = await api.post('/api/v1/transaction-reports')
    .set('Cookie', cookieHeader(seller.cookies)).set('X-CSRF-Token', csrf)
    .send({ orderId: orderPaid, reason: 'HARASSMENT', description: 'ทดสอบรายงานจากผู้ขาย' });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.report.reporterId, seller.id);
  assert.equal(response.body.data.report.reportedId, buyer.id);
});

test('rejects a report for an order the user is not part of', async () => {
  const csrf = cookieValue(other.cookies, 'gm_csrf');
  const response = await api.post('/api/v1/transaction-reports')
    .set('Cookie', cookieHeader(other.cookies)).set('X-CSRF-Token', csrf)
    .send({ orderId: orderPaid, reason: 'SCAM' });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'TRANSACTION_NOT_OWNED');
});


test('rejects reporting a pending transaction', async () => {
  const csrf = cookieValue(buyer.cookies, 'gm_csrf');
  const response = await api.post('/api/v1/transaction-reports')
    .set('Cookie', cookieHeader(buyer.cookies)).set('X-CSRF-Token', csrf)
    .send({ orderId: orderPending, reason: 'NO_DELIVERY' });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'TRANSACTION_NOT_REPORTABLE');
});

test('rejects reporting a cancelled transaction', async () => {
  const csrf = cookieValue(buyer.cookies, 'gm_csrf');
  const response = await api.post('/api/v1/transaction-reports')
    .set('Cookie', cookieHeader(buyer.cookies)).set('X-CSRF-Token', csrf)
    .send({ orderId: orderCancelled, reason: 'OTHER' });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'TRANSACTION_NOT_REPORTABLE');
});

test('rejects an invalid report reason', async () => {
  const response = await api.post('/api/v1/transaction-reports')
    .set('Cookie', cookieHeader(buyer.cookies)).set('X-CSRF-Token', cookieValue(buyer.cookies, 'gm_csrf'))
    .send({ orderId: orderPaid, reason: 'NOT_A_REAL_REASON' });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_REPORT_REASON');
});

test('requires CSRF protection when creating a report', async () => {
  const response = await api.post('/api/v1/transaction-reports')
    .set('Cookie', cookieHeader(buyer.cookies))
    .send({ orderId: orderPending, reason: 'SCAM' });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'CSRF_INVALID');
});

test('persists report state so history can identify that this user already reported the order', async () => {
  const [rows] = await pool.execute(
    'SELECT id,reporter_id,reported_id,status FROM transaction_reports WHERE order_id=? ORDER BY id',
    [orderPaid],
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => [Number(row.reporter_id), Number(row.reported_id), row.status]), [
    [buyer.id, seller.id, 'PENDING'],
    [seller.id, buyer.id, 'PENDING'],
  ]);
});
