const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const { pool } = require('../../backend/src/config/database');
const { hashPassword } = require('../../backend/src/utils/password');
const userRepository = require('../../backend/src/repositories/user.repository');
const roleRepository = require('../../backend/src/repositories/role.repository');
const app = require('../../backend/src/app');
const {
  cleanupTestUsers,
  closeTestDatabasePool,
  prepareTestDatabase,
} = require('../helpers/test-database');

if (process.env.NODE_ENV !== 'test' || process.env.DB_NAME !== 'gamemarket_test') {
  throw new Error('Run transaction report security tests with the test database guard active.');
}

const api = request(app);
const runId = crypto.randomUUID().replaceAll('-', '');
const emailPrefix = `reportsec_${runId}_`;
const customerUsername = `rsec_${runId.slice(0, 16)}`;
const adminUsername = `radmin_${runId.slice(0, 15)}`;
const customerEmail = `${emailPrefix}customer@example.test`;
const adminEmail = `${emailPrefix}admin@example.test`;
const password = 'TestPassword123';

function cookieValue(response, name) {
  const cookies = response.headers['set-cookie'] || [];
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  return cookie ? cookie.split(';', 1)[0].slice(name.length + 1) : null;
}

function cookieHeader(response) {
  return (response.headers['set-cookie'] || []).map((value) => value.split(';', 1)[0]).join('; ');
}

let customerAuth = null;
let adminAuth = null;
let adminId = null;

async function createAdmin() {
  const passwordHash = await hashPassword(password);
  adminId = await userRepository.create(pool, {
    email: adminEmail,
    username: adminUsername,
    firstName: 'Security',
    lastName: 'Admin',
    phone: '0898765432',
    dateOfBirth: '1990-01-01',
    passwordHash,
    accountMode: 'ADMIN',
  });
  const [adminRoleId] = await roleRepository.findIdsByCodes(pool, ['ADMIN']);
  assert.ok(adminRoleId);
  await userRepository.assignRoles(pool, adminId, [adminRoleId]);
}

before(async () => {
  await prepareTestDatabase();
  await cleanupTestUsers(emailPrefix);
  await createAdmin();
  const customer = await api.post('/api/v1/auth/register').send({
    email: customerEmail,
    username: customerUsername,
    password,
    firstName: 'Security',
    lastName: 'Customer',
    phone: '0887654321',
    dateOfBirth: '2000-01-01',
    accountType: 'CUSTOMER',
  });
  assert.equal(customer.status, 201);
  const admin = await api.post('/api/v1/auth/login').send({ username: adminUsername, password });
  assert.equal(admin.status, 200);
  customerAuth = customer;
  adminAuth = admin;
});

after(async () => {
  await cleanupTestUsers(emailPrefix);
  await closeTestDatabasePool();
});

test('rejects unauthenticated access to pending reports', async () => {
  const response = await api.get('/api/v1/transaction-reports/pending');
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'UNAUTHENTICATED');
});

test('rejects customer access to admin report list', async () => {
  const response = await api
    .get('/api/v1/transaction-reports/pending')
    .set('Cookie', cookieHeader(customerAuth));
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('rejects customer access to the full report endpoint', async () => {
  const response = await api
    .get('/api/v1/transaction-reports/admin')
    .set('Cookie', cookieHeader(customerAuth));
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('rejects customer access to report detail', async () => {
  const response = await api
    .get('/api/v1/transaction-reports/999999')
    .set('Cookie', cookieHeader(customerAuth));
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('rejects customer report status changes before CSRF validation', async () => {
  const response = await api
    .patch('/api/v1/transaction-reports/999999')
    .set('Cookie', cookieHeader(customerAuth))
    .send({ status: 'RESOLVED' });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('allows an authenticated admin to access the pending report endpoint', async () => {
  const response = await api
    .get('/api/v1/transaction-reports/pending')
    .set('Cookie', cookieHeader(adminAuth));
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.data.reports));
});

test('allows an authenticated admin to access the full report endpoint', async () => {
  const response = await api
    .get('/api/v1/transaction-reports/admin')
    .set('Cookie', cookieHeader(adminAuth));
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.data.reports));
});

test('rejects admin status changes without a CSRF token', async () => {
  const response = await api
    .patch('/api/v1/transaction-reports/999999')
    .set('Cookie', cookieHeader(adminAuth))
    .send({ status: 'RESOLVED' });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'CSRF_INVALID');
});

test('rejects admin status changes with an invalid CSRF token', async () => {
  const response = await api
    .patch('/api/v1/transaction-reports/999999')
    .set('Cookie', cookieHeader(adminAuth))
    .set('X-CSRF-Token', 'invalid-csrf-token')
    .send({ status: 'RESOLVED' });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'CSRF_INVALID');
});

test('allows an admin to reach report update authorization after valid CSRF', async () => {
  const response = await api
    .patch('/api/v1/transaction-reports/999999')
    .set('Cookie', cookieHeader(adminAuth))
    .set('X-CSRF-Token', cookieValue(adminAuth, 'gm_csrf'))
    .send({ status: 'RESOLVED' });
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'REPORT_NOT_FOUND');
});

test('allows an admin to request report detail but rejects a missing report cleanly', async () => {
  const response = await api
    .get('/api/v1/transaction-reports/999999')
    .set('Cookie', cookieHeader(adminAuth));
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'REPORT_NOT_FOUND');
});
