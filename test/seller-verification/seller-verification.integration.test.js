'use strict';

const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const request = require('supertest');
const { pool } = require('../../backend/src/config/database');
const { hashPassword } = require('../../backend/src/utils/password');
const userRepository = require('../../backend/src/repositories/user.repository');
const sellerVerificationRepository = require('../../backend/src/repositories/seller-verification.repository');
const app = require('../../backend/src/app');
const { cleanupTestUsers, closeTestDatabasePool, prepareTestDatabase } = require('../helpers/test-database');

if (process.env.NODE_ENV !== 'test' || process.env.DB_NAME !== require('../helpers/database-name')) {
  throw new Error('Seller verification tests are locked to the gamemarket_test database.');
}

const api = request(app);
const runId = crypto.randomUUID().replaceAll('-', '');
const emailPrefix = `sellerverify_${runId}_`;
const password = 'TestPassword123';
const sellerUploadsRoot = path.resolve(process.cwd(), 'uploads', 'seller-verification');
const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

let admin;
let approvalBuyer;
let rejectedBuyer;
let regularBuyer;

function cookies(response) {
  return (response.headers['set-cookie'] || []).map((value) => value.split(';', 1)[0]).join('; ');
}

function csrf(response) {
  const csrfCookie = (response.headers['set-cookie'] || []).find((value) => value.startsWith('gm_csrf='));
  return csrfCookie?.split(';', 1)[0].slice('gm_csrf='.length);
}

function userPayload(label) {
  const labelId = crypto.createHash('sha256').update(label).digest('hex').slice(0, 8);
  return {
    email: `${emailPrefix}${label}@example.test`,
    username: `sv_${runId.slice(0, 14)}_${labelId}`,
    password,
    firstName: 'Seller',
    lastName: 'Fixture',
    phone: '0812345678',
    dateOfBirth: '2000-01-01',
    accountType: 'CUSTOMER',
  };
}

async function registerVerifiedBuyer(label) {
  const payload = userPayload(label);
  const auth = await api.post('/api/v1/auth/register').send(payload);
  assert.equal(auth.status, 201);
  const userId = Number(auth.body.data.user.id);
  await pool.execute(
    'UPDATE users SET email_verified_at = UTC_TIMESTAMP(3), phone_verified_at = UTC_TIMESTAMP(3) WHERE id = ?',
    [userId],
  );
  return { ...payload, id: userId, auth };
}

async function registerBuyer(label) {
  const payload = userPayload(label);
  const auth = await api.post('/api/v1/auth/register').send(payload);
  assert.equal(auth.status, 201);
  return { ...payload, id: Number(auth.body.data.user.id), auth };
}

async function createAdmin() {
  const payload = userPayload('admin');
  const userId = await userRepository.create(pool, {
    email: payload.email,
    username: payload.username,
    firstName: 'Seller',
    lastName: 'Admin',
    phone: '0891234567',
    dateOfBirth: '1990-01-01',
    passwordHash: await hashPassword(password),
    accountMode: 'ADMIN',
  });
  const auth = await api.post('/api/v1/auth/login').send({ username: payload.username, password });
  assert.equal(auth.status, 200);
  return { ...payload, id: userId, auth };
}

async function uploadDocument(buyer, type) {
  const endpoints = {
    ID_FRONT: 'id-front',
    ID_BACK: 'id-back',
    SELFIE: 'selfie',
  };
  const response = await api
    .post(`/api/v1/seller-verification/documents/${endpoints[type]}`)
    .set('Cookie', cookies(buyer.auth))
    .set('X-CSRF-Token', csrf(buyer.auth))
    .attach('document', validJpeg, { filename: `${type.toLowerCase()}.jpg`, contentType: 'image/jpeg' });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.document.document_type, type);
  return response;
}

async function submitApplication(buyer) {
  const response = await api
    .post('/api/v1/seller-verification/submit')
    .set('Cookie', cookies(buyer.auth))
    .set('X-CSRF-Token', csrf(buyer.auth));
  assert.equal(response.status, 200);
  assert.equal(response.body.data.verification.status, 'PENDING');
  return response;
}

async function uploadRequiredDocuments(buyer) {
  await uploadDocument(buyer, 'ID_FRONT');
  await uploadDocument(buyer, 'ID_BACK');
  await uploadDocument(buyer, 'SELFIE');
}

function fixtureUploadDirectory(userId) {
  const directory = path.resolve(sellerUploadsRoot, String(userId));
  assert.ok(directory.startsWith(`${sellerUploadsRoot}${path.sep}`));
  return directory;
}

async function cleanupSellerFixtures() {
  const [users] = await pool.execute('SELECT id FROM users WHERE email LIKE ?', [`${emailPrefix}%`]);
  const userIds = users.map(({ id }) => Number(id));

  if (userIds.length > 0) {
    const placeholders = userIds.map(() => '?').join(', ');
    await pool.execute(`DELETE FROM notifications WHERE user_id IN (${placeholders})`, userIds);
    await pool.execute(`DELETE FROM seller_verification_requests WHERE user_id IN (${placeholders})`, userIds);
    await Promise.all(userIds.map((userId) => fs.rm(fixtureUploadDirectory(userId), { recursive: true, force: true })));
  }

  await cleanupTestUsers(emailPrefix);
}

before(async () => {
  await prepareTestDatabase();
  await cleanupSellerFixtures();
  admin = await createAdmin();
  approvalBuyer = await registerVerifiedBuyer('approval');
  rejectedBuyer = await registerVerifiedBuyer('rejection');
  regularBuyer = await registerVerifiedBuyer('regular');
});

after(async () => {
  await cleanupSellerFixtures();
  await closeTestDatabasePool();
});

test('rejects seller document uploads from an unverified customer', async () => {
  const buyer = await registerBuyer('unverified');
  const response = await api
    .post('/api/v1/seller-verification/documents/id-front')
    .set('Cookie', cookies(buyer.auth))
    .set('X-CSRF-Token', csrf(buyer.auth))
    .attach('document', validJpeg, { filename: 'id-front.jpg', contentType: 'image/jpeg' });

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'ACCOUNT_NOT_VERIFIED');
  const [requests] = await pool.execute('SELECT id FROM seller_verification_requests WHERE user_id = ?', [buyer.id]);
  assert.equal(requests.length, 0);
});

test('preserves document IDs, upload order and metadata when replacing an embedded document', async () => {
  const buyer = await registerVerifiedBuyer('document-identity');
  const selfie = await uploadDocument(buyer, 'SELFIE');
  const back = await uploadDocument(buyer, 'ID_BACK');
  const front = await uploadDocument(buyer, 'ID_FRONT');
  const originalIds = [selfie, back, front].map((response) => response.body.data.document.id);
  assert.equal(new Set(originalIds).size, 3);
  const replacement = await uploadDocument(buyer, 'SELFIE');
  assert.equal(replacement.body.data.document.id, originalIds[0]);
  const status = await api.get('/api/v1/seller-verification/me').set('Cookie', cookies(buyer.auth));
  assert.equal(status.status, 200);
  const documents = await sellerVerificationRepository.listDocuments(selfie.body.data.request.id);
  assert.deepEqual(documents.map((document) => document.document_type), ['SELFIE', 'ID_BACK', 'ID_FRONT']);
  assert.deepEqual(documents.map((document) => document.id), originalIds);
  assert.ok(documents.every((document) => document.sha256 === crypto.createHash('sha256').update(validJpeg).digest('hex')));
  assert.ok(documents.every((document) => document.created_at && document.storage_path && document.mime_type === 'image/jpeg'));
  const anotherBuyer = await registerVerifiedBuyer('document-identity-other');
  const another = await uploadDocument(anotherBuyer, 'SELFIE');
  assert.ok(!originalIds.includes(another.body.data.document.id));
});

test('keeps an incomplete verified application as a draft', async () => {
  const buyer = await registerVerifiedBuyer('incomplete');
  await uploadDocument(buyer, 'ID_FRONT');

  const response = await api
    .post('/api/v1/seller-verification/submit')
    .set('Cookie', cookies(buyer.auth))
    .set('X-CSRF-Token', csrf(buyer.auth));
  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'SELLER_DOCUMENTS_INCOMPLETE');

  const [requests] = await pool.execute('SELECT id, status FROM seller_verification_requests WHERE user_id = ?', [buyer.id]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].status, 'DRAFT');
  const documents = await sellerVerificationRepository.listDocuments(requests[0].id);
  assert.deepEqual(documents.map((document) => document.document_type), ['ID_FRONT']);
});

test('rejects invalid image content without persisting a document or file', async () => {
  const buyer = await registerVerifiedBuyer('invalid-upload');
  const response = await api
    .post('/api/v1/seller-verification/documents/id-front')
    .set('Cookie', cookies(buyer.auth))
    .set('X-CSRF-Token', csrf(buyer.auth))
    .attach('document', Buffer.from('not an image'), { filename: 'id-front.jpg', contentType: 'image/jpeg' });

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'INVALID_SELLER_DOCUMENT_CONTENT');
  const [requests] = await pool.execute('SELECT id FROM seller_verification_requests WHERE user_id = ?', [buyer.id]);
  assert.equal(requests.length, 0);
  await assert.rejects(fs.access(fixtureUploadDirectory(buyer.id)), { code: 'ENOENT' });
});

test('prevents document changes and resubmission while an application is pending', async () => {
  const buyer = await registerVerifiedBuyer('pending-protection');
  await uploadRequiredDocuments(buyer);
  await submitApplication(buyer);

  const upload = await api
    .post('/api/v1/seller-verification/documents/selfie')
    .set('Cookie', cookies(buyer.auth))
    .set('X-CSRF-Token', csrf(buyer.auth))
    .attach('document', validJpeg, { filename: 'selfie.jpg', contentType: 'image/jpeg' });
  assert.equal(upload.status, 409);
  assert.equal(upload.body.error.code, 'SELLER_REQUEST_PENDING');

  const resubmit = await api
    .post('/api/v1/seller-verification/submit')
    .set('Cookie', cookies(buyer.auth))
    .set('X-CSRF-Token', csrf(buyer.auth));
  assert.equal(resubmit.status, 409);
  assert.equal(resubmit.body.error.code, 'SELLER_REQUEST_NOT_READY');

  const [requests] = await pool.execute('SELECT id, status FROM seller_verification_requests WHERE user_id = ?', [buyer.id]);
  assert.equal(requests[0].status, 'PENDING');
  const documents = await sellerVerificationRepository.listDocuments(requests[0].id);
  assert.equal(documents.length, 3);
});

test('validates a rejection reason before changing a pending application', async () => {
  const buyer = await registerVerifiedBuyer('rejection-validation');
  await uploadRequiredDocuments(buyer);
  await submitApplication(buyer);

  const response = await api
    .post(`/api/v1/seller-verification/${buyer.id}/reject`)
    .set('Cookie', cookies(admin.auth))
    .set('X-CSRF-Token', csrf(admin.auth))
    .send({ reason: 'x' });
  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'INVALID_REJECTION_REASON');

  const [requests] = await pool.execute(
    'SELECT status, rejection_reason, reviewed_by, reviewed_at FROM seller_verification_requests WHERE user_id = ?',
    [buyer.id],
  );
  assert.equal(requests[0].status, 'PENDING');
  assert.equal(requests[0].rejection_reason, null);
  assert.equal(requests[0].reviewed_by, null);
  assert.equal(requests[0].reviewed_at, null);
});

test('prevents a non-admin customer from approving or rejecting a pending application', async () => {
  const buyer = await registerVerifiedBuyer('admin-authorization');
  await uploadRequiredDocuments(buyer);
  await submitApplication(buyer);

  const approve = await api
    .post(`/api/v1/seller-verification/${buyer.id}/approve`)
    .set('Cookie', cookies(regularBuyer.auth))
    .set('X-CSRF-Token', csrf(regularBuyer.auth));
  assert.equal(approve.status, 403);
  assert.equal(approve.body.error.code, 'FORBIDDEN');

  const reject = await api
    .post(`/api/v1/seller-verification/${buyer.id}/reject`)
    .set('Cookie', cookies(regularBuyer.auth))
    .set('X-CSRF-Token', csrf(regularBuyer.auth))
    .send({ reason: 'A valid rejection reason.' });
  assert.equal(reject.status, 403);
  assert.equal(reject.body.error.code, 'FORBIDDEN');

  const [requests] = await pool.execute('SELECT status, reviewed_by, rejection_reason FROM seller_verification_requests WHERE user_id = ?', [buyer.id]);
  assert.equal(requests[0].status, 'PENDING');
  assert.equal(requests[0].reviewed_by, null);
  assert.equal(requests[0].rejection_reason, null);
});

test('approves a verified buyer application and requires a fresh seller session', async () => {
  await uploadRequiredDocuments(approvalBuyer);
  await submitApplication(approvalBuyer);

  const pending = await api.get('/api/v1/seller-verification/admin/pending').set('Cookie', cookies(admin.auth));
  assert.equal(pending.status, 200);
  assert.ok(pending.body.data.requests.some((item) => Number(item.user_id) === approvalBuyer.id && item.status === 'PENDING'));

  const detail = await api.get(`/api/v1/seller-verification/admin/${approvalBuyer.id}`).set('Cookie', cookies(admin.auth));
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.request.status, 'PENDING');
  assert.deepEqual(
    detail.body.data.request.documents.map((document) => document.document_type).sort(),
    ['ID_BACK', 'ID_FRONT', 'SELFIE'],
  );
  assert.ok(detail.body.data.request.documents.every((document) => document.mime_type === 'image/jpeg' && document.file_size === validJpeg.length));

  const document = await api
    .get(`/api/v1/seller-verification/admin/${approvalBuyer.id}/documents/ID_FRONT`)
    .set('Cookie', cookies(admin.auth));
  assert.equal(document.status, 200);
  assert.match(document.headers['content-type'], /^image\/jpeg/);

  const approval = await api
    .post(`/api/v1/seller-verification/${approvalBuyer.id}/approve`)
    .set('Cookie', cookies(admin.auth))
    .set('X-CSRF-Token', csrf(admin.auth));
  assert.equal(approval.status, 200);
  assert.ok(approval.body.data.user.roles.includes('SELLER'));
  assert.equal(approval.body.data.user.accountMode, 'UNIFIED');

  const [requests] = await pool.execute(
    'SELECT status, reviewed_by, reviewed_at FROM seller_verification_requests WHERE user_id = ?',
    [approvalBuyer.id],
  );
  assert.equal(requests[0].status, 'APPROVED');
  assert.equal(Number(requests[0].reviewed_by), admin.id);
  assert.ok(requests[0].reviewed_at);

  const [notifications] = await pool.execute(
    "SELECT type FROM notifications WHERE user_id = ? AND type = 'SELLER_VERIFICATION_APPROVED'",
    [approvalBuyer.id],
  );
  assert.equal(notifications.length, 1);

  const staleSession = await api.get('/api/v1/auth/me').set('Cookie', cookies(approvalBuyer.auth));
  assert.equal(staleSession.status, 401);
  assert.equal(staleSession.body.error.code, 'INVALID_SESSION');

  const staleRefresh = await api.post('/api/v1/auth/refresh').set('Cookie', cookies(approvalBuyer.auth));
  assert.equal(staleRefresh.status, 401);
  assert.equal(staleRefresh.body.error.code, 'REFRESH_TOKEN_REUSED');

  const freshLogin = await api.post('/api/v1/auth/login').send({ username: approvalBuyer.username, password });
  assert.equal(freshLogin.status, 200);
  assert.ok(freshLogin.body.data.user.roles.includes('SELLER'));
  assert.equal(freshLogin.body.data.user.accountMode, 'UNIFIED');
});

test('prevents an admin from changing an approved request back to rejected', async () => {
  const response = await api
    .post(`/api/v1/seller-verification/${approvalBuyer.id}/reject`)
    .set('Cookie', cookies(admin.auth))
    .set('X-CSRF-Token', csrf(admin.auth))
    .send({ reason: 'A valid rejection reason.' });
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'SELLER_REQUEST_NOT_PENDING');

  const [requests] = await pool.execute('SELECT status, rejection_reason FROM seller_verification_requests WHERE user_id = ?', [approvalBuyer.id]);
  assert.equal(requests[0].status, 'APPROVED');
  assert.equal(requests[0].rejection_reason, null);
  const user = await userRepository.findAuthUserById(approvalBuyer.id);
  assert.ok(user.roles.includes('SELLER'));
  assert.equal(user.accountMode, 'UNIFIED');
});

test('rejects an application, preserves review metadata, and allows resubmission', async () => {
  await uploadRequiredDocuments(rejectedBuyer);
  await submitApplication(rejectedBuyer);

  const reason = 'Selfie image needs to be clearer.';
  const rejection = await api
    .post(`/api/v1/seller-verification/${rejectedBuyer.id}/reject`)
    .set('Cookie', cookies(admin.auth))
    .set('X-CSRF-Token', csrf(admin.auth))
    .send({ reason });
  assert.equal(rejection.status, 200);
  assert.equal(rejection.body.data.verification.status, 'REJECTED');

  const [requests] = await pool.execute(
    'SELECT status, rejection_reason, reviewed_by, reviewed_at FROM seller_verification_requests WHERE user_id = ?',
    [rejectedBuyer.id],
  );
  assert.equal(requests[0].status, 'REJECTED');
  assert.equal(requests[0].rejection_reason, reason);
  assert.equal(Number(requests[0].reviewed_by), admin.id);
  assert.ok(requests[0].reviewed_at);

  const [notifications] = await pool.execute(
    "SELECT type FROM notifications WHERE user_id = ? AND type = 'SELLER_VERIFICATION_REJECTED'",
    [rejectedBuyer.id],
  );
  assert.equal(notifications.length, 1);

  const afterRejection = await api.get('/api/v1/auth/me').set('Cookie', cookies(rejectedBuyer.auth));
  assert.equal(afterRejection.status, 200);
  assert.ok(afterRejection.body.data.user.roles.includes('CUSTOMER'));
  assert.ok(!afterRejection.body.data.user.roles.includes('SELLER'));
  assert.equal(afterRejection.body.data.user.accountMode, 'CUSTOMER_ONLY');

  await uploadDocument(rejectedBuyer, 'SELFIE');
  await submitApplication(rejectedBuyer);

  const [resubmitted] = await pool.execute('SELECT status FROM seller_verification_requests WHERE user_id = ?', [rejectedBuyer.id]);
  assert.equal(resubmitted[0].status, 'PENDING');
});

test('keeps seller documents protected while allowing the admin pending, history, and detail flow', async () => {
  const pending = await api.get('/api/v1/seller-verification/admin/pending').set('Cookie', cookies(admin.auth));
  assert.equal(pending.status, 200);
  assert.ok(pending.body.data.requests.some((item) => Number(item.user_id) === rejectedBuyer.id && item.status === 'PENDING'));

  const history = await api.get('/api/v1/seller-verification/admin/history').set('Cookie', cookies(admin.auth));
  assert.equal(history.status, 200);
  assert.ok(history.body.data.history.some((item) => Number(item.user_id) === approvalBuyer.id && item.status === 'APPROVED'));

  const detail = await api.get(`/api/v1/seller-verification/admin/${rejectedBuyer.id}`).set('Cookie', cookies(admin.auth));
  assert.equal(detail.status, 200);
  const selfie = detail.body.data.request.documents.find((document) => document.document_type === 'SELFIE');
  assert.ok(selfie);
  assert.equal(selfie.mime_type, 'image/jpeg');

  const adminDocument = await api
    .get(`/api/v1/seller-verification/admin/${rejectedBuyer.id}/documents/SELFIE`)
    .set('Cookie', cookies(admin.auth));
  assert.equal(adminDocument.status, 200);
  assert.match(adminDocument.headers['content-type'], /^image\/jpeg/);

  const publicDocument = await api.get(`/${selfie.storage_path}`);
  assert.equal(publicDocument.status, 404);

  const nonAdminDocument = await api
    .get(`/api/v1/seller-verification/admin/${rejectedBuyer.id}/documents/SELFIE`)
    .set('Cookie', cookies(regularBuyer.auth));
  assert.equal(nonAdminDocument.status, 403);
  assert.equal(nonAdminDocument.body.error.code, 'FORBIDDEN');
});
