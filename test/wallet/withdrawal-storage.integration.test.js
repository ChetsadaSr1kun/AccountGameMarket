const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');
const app = require('../../backend/src/app');
const { pool } = require('../../backend/src/config/database');
const users = require('../../backend/src/repositories/user.repository');
const attempts = require('../../backend/src/repositories/withdrawal-attempt.repository');
const requests = require('../../backend/src/repositories/withdrawal.repository');
const flow = require('../../backend/src/services/withdrawal-attempt.service');
const withdrawals = require('../../backend/src/services/withdrawal.service');
const adminWallet = require('../../backend/src/services/wallet-admin.service');
const wallet = require('../../backend/src/repositories/wallet.repository');
const email = require('../../backend/src/services/email.service');
const sms = require('../../backend/src/services/sms.service');
const { hashPassword } = require('../../backend/src/utils/password');
const { prepareTestDatabase, cleanupTestUsers, closeTestDatabasePool } = require('../helpers/test-database');
const prefix = `withdrawstorage_${crypto.randomUUID().replaceAll('-', '')}`;
const api = request(app);
const payload = { amount: '100.10', paymentMethod: 'BANK', bankCode: 'KBANK',
  accountName: 'Withdrawal Fixture', accountNumber: '1234567890' };
const original = { email: email.sendEmailVerificationOtp, send: sms.sendPhoneVerificationOtp,
  check: sms.checkPhoneVerificationOtp };
let alice, bob, admin, emailOtp;
async function makeUser(label, accountMode) {
  const username = `${label}_${prefix.slice(-20)}`;
  const password = 'TestPassword123';
  const id = await users.create(pool, { email: `${prefix}_${label}@example.test`, username,
    firstName: 'Withdrawal', lastName: 'Fixture', phone: '0812345678', dateOfBirth: '2000-01-01',
    passwordHash: await hashPassword(password), accountMode });
  await pool.execute('UPDATE users SET email_verified_at=UTC_TIMESTAMP(3),phone_verified_at=UTC_TIMESTAMP(3) WHERE id=?', [id]);
  const login = await api.post('/api/v1/auth/login').send({ username, password });
  assert.equal(login.status, 200);
  const cookies = login.headers['set-cookie'].map(value => value.split(';')[0]);
  return { id, cookie: cookies.join('; '), csrf: cookies.find(value => value.startsWith('gm_csrf=')).slice(8) };
}
async function fundedAttempt() {
  await wallet.ensureWallet(alice.id);
  await pool.execute("UPDATE users SET wallet_balance='1000.30' WHERE id=?", [alice.id]);
  return flow.createAttempt(alice.id, payload);
}
async function verifyBoth(attempt) {
  await flow.sendEmailOtp(alice.id, attempt.id);
  await flow.verifyEmailOtp(alice.id, attempt.id, emailOtp);
  await flow.sendPhoneOtp(alice.id, attempt.id);
  await flow.verifyPhoneOtp(alice.id, attempt.id, '123456');
}
async function balance() {
  const [[row]] = await pool.execute('SELECT wallet_balance FROM users WHERE id=?', [alice.id]);
  return row.wallet_balance;
}
before(async () => {
  await prepareTestDatabase();
  alice = await makeUser('alice', 'CUSTOMER_ONLY');
  bob = await makeUser('bob', 'SELLER_ONLY');
  admin = await makeUser('admin', 'ADMIN');
  email.sendEmailVerificationOtp = async ({ otp }) => { emailOtp = otp; };
  sms.sendPhoneVerificationOtp = async () => ({ sid: 'test-only-withdrawal' });
  sms.checkPhoneVerificationOtp = async () => ({ status: 'approved' });
});
after(async () => {
  email.sendEmailVerificationOtp = original.email;
  sms.sendPhoneVerificationOtp = original.send;
  sms.checkPhoneVerificationOtp = original.check;
  await cleanupTestUsers(prefix);
  await closeTestDatabasePool();
});

test('colliding request and attempt public IDs preserve lookups, admin actions, ledger and notifications', async () => {
  const attempt = await fundedAttempt();
  const pending = await withdrawals.createRequest(alice.id, payload);
  // Simulate an old request ID equal to an attempt ID. Ledger references follow the public ID.
  await pool.execute("UPDATE withdrawals SET legacy_request_id=? WHERE record_type='REQUEST' AND id=?", [attempt.id, pending.id]);
  await pool.execute("UPDATE wallet_transactions SET reference_id=? WHERE wallet_user_id=? AND reference_type='WITHDRAWAL_REQUEST' AND reference_id=?", [attempt.id, alice.id, pending.id]);
  assert.equal((await requests.findById(attempt.id)).status, 'PENDING');
  assert.equal(await attempts.findById(pending.id), null);
  const results = await Promise.allSettled([
    adminWallet.decideWithdrawal(attempt.id, admin.id, false, 'Fixture rejection'),
    adminWallet.decideWithdrawal(attempt.id, admin.id, false, 'Fixture rejection'),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'WITHDRAWAL_ALREADY_PROCESSED');
  assert.equal(await balance(), '1000.30');
  assert.equal((await attempts.findById(attempt.id)).status, 'PENDING');
  assert.equal((await requests.findById(attempt.id)).status, 'REJECTED');
  const [[ledger]] = await pool.execute("SELECT COUNT(*) n FROM wallet_transactions WHERE wallet_user_id=? AND reference_id=? AND reference_type='WITHDRAWAL_REQUEST' AND type='REFUND'", [alice.id, attempt.id]);
  assert.equal(ledger.n, 1);
  const [[notification]] = await pool.execute("SELECT COUNT(*) n FROM notifications WHERE user_id=? AND reference_type='WITHDRAWAL' AND reference_id=?", [alice.id, attempt.id]);
  assert.equal(notification.n, 1);
});

test('email then phone OTP and concurrent completion debit exactly once and create one linked request', async () => {
  const attempt = await fundedAttempt();
  await assert.rejects(flow.markCompleted(alice.id, attempt.id), { code: 'EMAIL_OTP_REQUIRED' });
  await assert.rejects(flow.sendPhoneOtp(alice.id, attempt.id), { code: 'EMAIL_OTP_REQUIRED' });
  await flow.sendEmailOtp(alice.id, attempt.id);
  await flow.verifyEmailOtp(alice.id, attempt.id, emailOtp);
  await assert.rejects(flow.markCompleted(alice.id, attempt.id), { code: 'PHONE_OTP_REQUIRED' });
  await flow.sendPhoneOtp(alice.id, attempt.id);
  await flow.verifyPhoneOtp(alice.id, attempt.id, '123456');
  const results = await Promise.allSettled([flow.markCompleted(alice.id, attempt.id), flow.markCompleted(alice.id, attempt.id)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'WITHDRAWAL_ATTEMPT_NOT_ACTIVE');
  const completed = results.find(r => r.status === 'fulfilled').value;
  const [[link]] = await pool.execute("SELECT COUNT(*) n,MIN(id) id FROM withdrawals WHERE record_type='REQUEST' AND source_attempt_id=?", [attempt.id]);
  assert.equal(link.n, 1);
  assert.equal(link.id, completed.withdrawalRequestId);
  assert.equal(await balance(), '900.20');
  const [ledger] = await pool.execute("SELECT amount,balance_after FROM wallet_transactions WHERE wallet_user_id=? AND reference_type='WITHDRAWAL_REQUEST' AND reference_id=?", [alice.id, completed.withdrawalRequestId]);
  assert.deepEqual(ledger, [{ amount: '-100.10', balance_after: '900.20' }]);
  await assert.rejects(requests.create({ ...payload, userId: alice.id, sourceAttemptId: attempt.id }), { code: 'ER_DUP_ENTRY' });
  const { withTransaction } = require('../../backend/src/utils/transaction');
  await assert.rejects(withTransaction(connection =>
    withdrawals.createRequestWithConnection(alice.id, payload, connection, attempt.id)), { code: 'ER_DUP_ENTRY' });
  assert.equal(await balance(), '900.20');
  await adminWallet.decideWithdrawal(completed.withdrawalRequestId, admin.id, true);
  assert.equal(await balance(), '900.20');
  const [otps] = await pool.execute('SELECT used_at FROM withdrawal_attempt_otps WHERE withdrawal_attempt_id=?', [attempt.id]);
  assert.equal(otps.length, 2);
  assert.ok(otps.every(row => row.used_at));
});

test('insufficient funds roll back request and ledger while preserving verified attempt', async () => {
  const attempt = await fundedAttempt();
  await verifyBoth(attempt);
  await pool.execute("UPDATE users SET wallet_balance='99.99' WHERE id=?", [alice.id]);
  await assert.rejects(flow.markCompleted(alice.id, attempt.id), { code: 'INSUFFICIENT_BALANCE' });
  assert.equal(await balance(), '99.99');
  assert.equal((await attempts.findById(attempt.id)).status, 'PENDING');
  const [[count]] = await pool.execute('SELECT COUNT(*) n FROM withdrawals WHERE source_attempt_id=?', [attempt.id]);
  assert.equal(count.n, 0);
});

test('foreign keys reject OTPs and source links targeting request rows', async () => {
  await fundedAttempt();
  const pending = await withdrawals.createRequest(alice.id, payload);
  await assert.rejects(attempts.createOrReplaceOtp(pool, { withdrawalAttemptId: pending.id, channel: 'EMAIL',
    otpHash: '0'.repeat(64), expiresAt: new Date(Date.now() + 60000) }), { code: 'ER_NO_REFERENCED_ROW_2' });
  await assert.rejects(requests.create({ ...payload, userId: alice.id, sourceAttemptId: pending.id }), { code: 'ER_NO_REFERENCED_ROW_2' });
});

test('incorrect email OTP attempts persist and the fifth failure invalidates the OTP', async () => {
  const attempt = await fundedAttempt();
  await flow.sendEmailOtp(alice.id, attempt.id);
  const wrong = emailOtp === '000000' ? '111111' : '000000';
  for (let i = 1; i <= 5; i++) {
    await assert.rejects(flow.verifyEmailOtp(alice.id, attempt.id, wrong),
      { code: i === 5 ? 'OTP_ATTEMPTS_EXCEEDED' : 'OTP_INVALID_OR_EXPIRED' });
    const row = await attempts.findOtpByAttemptAndChannel(attempt.id, 'EMAIL');
    assert.equal(row.attempts, i);
    assert.equal(Boolean(row.invalidated_at), i === 5);
  }
  await assert.rejects(flow.verifyEmailOtp(alice.id, attempt.id, emailOtp), { code: 'OTP_INVALID_OR_EXPIRED' });
  assert.equal((await attempts.findById(attempt.id)).email_verified_at, null);
});

test('OTP cooldown, expiry, reuse and cancelled or expired attempts stay blocked', async () => {
  const attempt = await fundedAttempt();
  await flow.sendEmailOtp(alice.id, attempt.id);
  await assert.rejects(flow.sendEmailOtp(alice.id, attempt.id), { code: 'OTP_RESEND_COOLDOWN' });
  await pool.execute("UPDATE withdrawal_attempt_otps SET expires_at=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND WHERE withdrawal_attempt_id=?", [attempt.id]);
  await assert.rejects(flow.verifyEmailOtp(alice.id, attempt.id, emailOtp), { code: 'OTP_INVALID_OR_EXPIRED' });
  assert.ok((await attempts.findOtpByAttemptAndChannel(attempt.id, 'EMAIL')).invalidated_at);
  const valid = await fundedAttempt();
  await flow.sendEmailOtp(alice.id, valid.id);
  await flow.verifyEmailOtp(alice.id, valid.id, emailOtp);
  await assert.rejects(flow.verifyEmailOtp(alice.id, valid.id, emailOtp), { code: 'OTP_INVALID_OR_EXPIRED' });
  await flow.cancelAttempt(alice.id, valid.id);
  await assert.rejects(flow.markCompleted(alice.id, valid.id), { code: 'WITHDRAWAL_ATTEMPT_NOT_ACTIVE' });
  await pool.execute("UPDATE withdrawals SET expires_at=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND WHERE id=?", [attempt.id]);
  await assert.rejects(flow.sendEmailOtp(alice.id, attempt.id), { code: 'WITHDRAWAL_ATTEMPT_EXPIRED' });
});

test('phone provider rejection and expired phone OTP never verify the attempt', async () => {
  const attempt = await fundedAttempt();
  await flow.sendEmailOtp(alice.id, attempt.id);
  await flow.verifyEmailOtp(alice.id, attempt.id, emailOtp);
  await flow.sendPhoneOtp(alice.id, attempt.id);
  sms.checkPhoneVerificationOtp = async () => ({ status: 'pending' });
  try {
    await assert.rejects(flow.verifyPhoneOtp(alice.id, attempt.id, '123456'), { code: 'OTP_INVALID_OR_EXPIRED' });
    assert.equal((await attempts.findById(attempt.id)).phone_verified_at, null);
  } finally {
    sms.checkPhoneVerificationOtp = async () => ({ status: 'approved' });
  }
  await pool.execute("UPDATE withdrawal_attempt_otps SET expires_at=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND WHERE withdrawal_attempt_id=? AND channel='PHONE'", [attempt.id]);
  await assert.rejects(flow.verifyPhoneOtp(alice.id, attempt.id, '123456'), { code: 'OTP_INVALID_OR_EXPIRED' });
  assert.ok((await attempts.findOtpByAttemptAndChannel(attempt.id, 'PHONE')).invalidated_at);
  assert.equal((await attempts.findById(attempt.id)).phone_verified_at, null);
});

test('withdrawal APIs retain response fields, ownership, CSRF and admin authorization', async () => {
  const missingCsrf = await api.post('/api/v1/wallet/withdrawal-attempts').set('Cookie', alice.cookie).send(payload);
  assert.equal(missingCsrf.status, 403);
  const created = await api.post('/api/v1/wallet/withdrawal-attempts').set('Cookie', alice.cookie).set('X-CSRF-Token', alice.csrf).send(payload);
  assert.equal(created.status, 201);
  const attempt = created.body.data.attempt;
  assert.deepEqual(Object.keys(attempt).sort(), ['id','userId','amount','paymentMethod','bankCode','accountName','accountNumber','status','emailVerifiedAt','phoneVerifiedAt','expiresAt','createdAt','updatedAt'].sort());
  const forbidden = await api.get(`/api/v1/wallet/withdrawal-attempts/${attempt.id}`).set('Cookie', bob.cookie);
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.body.error.code, 'WITHDRAWAL_ATTEMPT_FORBIDDEN');
  const adminForbidden = await api.get('/api/v1/admin/wallet/withdrawal/history').set('Cookie', alice.cookie);
  assert.equal(adminForbidden.status, 403);
  const history = await api.get('/api/v1/admin/wallet/withdrawal/history').set('Cookie', admin.cookie);
  assert.equal(history.status, 200);
  assert.ok(history.body.data.history.every(row => ['PENDING','APPROVED','REJECTED'].includes(row.status)));
  const mine = await api.get('/api/v1/wallet/withdrawals').set('Cookie', alice.cookie);
  assert.equal(mine.status, 200);
  assert.ok(mine.body.data.requests.every(row => row.id !== attempt.id));
  for (const body of [created.body, history.body, mine.body]) {
    assert.doesNotMatch(JSON.stringify(body), /otp_hash|token_hash|password|source_attempt|legacy_request|record_type|provider_reference/i);
  }
});
