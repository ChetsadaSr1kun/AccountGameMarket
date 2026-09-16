const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { after, before, test } = require('node:test');

const { pool } = require('../../backend/src/config/database');
const userRepository = require('../../backend/src/repositories/user.repository');
const topupRepository = require('../../backend/src/repositories/wallet-topup.repository');
const topupService = require('../../backend/src/services/wallet-topup.service');
const slipOkService = require('../../backend/src/services/slipok.service');
const walletAdminService = require('../../backend/src/services/wallet-admin.service');
const { assertTestDatabase, closeTestDatabasePool, prepareTestDatabase } = require('../helpers/test-database');

assertTestDatabase();

const runId = crypto.randomUUID().replaceAll('-', '');
const email = `slipok_${runId}@example.test`;
const username = `slip_${runId.slice(0, 20)}`;
let userId;

async function cleanup() {
  if (userId) await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
}

before(async () => {
  await prepareTestDatabase();
  userId = await userRepository.create(pool, {
    email, username, firstName: 'Slip', lastName: 'Test', phone: '0812345678',
    dateOfBirth: '2000-01-01', passwordHash: 'test-hash', accountMode: 'CUSTOMER_ONLY',
  });
});

after(async () => {
  await cleanup();
  await closeTestDatabasePool();
});

test('creates a SlipOK-managed top-up request with no gateway redirect', async () => {
  const request = await topupService.createRequest(userId, 'PROMPTPAY', 250);
  assert.equal(request.provider, 'SLIPOK');
  assert.equal(request.providerStatus, 'AWAITING_SLIP');
  assert.equal(request.status, 'PENDING');
  assert.equal(request.providerPaymentUrl, undefined);
  assert.equal(request.providerQrUrl, undefined);
  await pool.execute('DELETE FROM wallet_topup_requests WHERE id = ?', [request.id]);
});

test('credits a verified SlipOK slip once and creates its wallet notification', async () => {
  const request = await topupService.createRequest(userId, 'BANK', 250);
  const originalCheckSlip = slipOkService.checkSlip;
  slipOkService.checkSlip = async () => ({
    success: true,
    amount: 250,
    transRef: 'SLIP-UNIQUE-250',
    transTimestamp: '2026-09-16T03:00:00+07:00',
  });

  try {
    const first = await topupService.processSlipOkVerification(request.id, userId, {
      buffer: Buffer.from('fake-image'), mimetype: 'image/png', originalname: 'slip.png',
    });
    const duplicate = await topupService.processSlipOkVerification(request.id, userId, {
      buffer: Buffer.from('fake-image'), mimetype: 'image/png', originalname: 'slip.png',
    });

    assert.deepEqual(first, { id: request.id, status: 'APPROVED', duplicate: false });
    assert.deepEqual(duplicate, { id: request.id, status: 'APPROVED', duplicate: true });

    const [[row]] = await pool.execute(
      'SELECT status, provider, provider_status, slipok_trans_ref FROM wallet_topup_requests WHERE id = ?',
      [request.id],
    );
    assert.equal(row.status, 'APPROVED');
    assert.equal(row.provider, 'SLIPOK');
    assert.equal(row.provider_status, 'VERIFIED');
    assert.equal(row.slipok_trans_ref, 'SLIP-UNIQUE-250');

    const [[wallet]] = await pool.execute('SELECT balance FROM wallets WHERE user_id = ?', [userId]);
    assert.equal(Number(wallet.balance), 250);

    const [[tx]] = await pool.execute(
      "SELECT COUNT(*) AS count FROM wallet_transactions WHERE wallet_user_id = ? AND reference_type = 'WALLET_TOPUP' AND reference_id = ?",
      [userId, request.id],
    );
    assert.equal(Number(tx.count), 1);

    const [[notification]] = await pool.execute(
      "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND type = 'WALLET_TOPUP' AND reference_id = ?",
      [userId, request.id],
    );
    assert.equal(Number(notification.count), 1);
  } finally {
    slipOkService.checkSlip = originalCheckSlip;
  }
});

test('rejects reuse of the same SlipOK transaction reference on another request', async () => {
  const requestA = await topupService.createRequest(userId, 'BANK', 100);
  const requestB = await topupService.createRequest(userId, 'BANK', 100);
  const originalCheckSlip = slipOkService.checkSlip;
  slipOkService.checkSlip = async () => ({ success: true, amount: 100, transRef: 'SLIP-DUPLICATE-1' });

  try {
    await topupService.processSlipOkVerification(requestA.id, userId, {
      buffer: Buffer.from('fake'), mimetype: 'image/png', originalname: 'slip.png',
    });
    await assert.rejects(
      topupService.processSlipOkVerification(requestB.id, userId, {
        buffer: Buffer.from('fake'), mimetype: 'image/png', originalname: 'slip.png',
      }),
      (error) => error?.code === 'SLIP_ALREADY_USED',
    );
  } finally {
    slipOkService.checkSlip = originalCheckSlip;
    await pool.execute('DELETE FROM wallet_topup_requests WHERE id = ?', [requestB.id]);
    await pool.execute('DELETE FROM wallet_topup_requests WHERE id = ?', [requestA.id]);
  }
});

test('does not allow legacy admin crediting for a SlipOK-managed request', async () => {
  const request = await topupService.createRequest(userId, 'BANK', 100);
  await assert.rejects(
    walletAdminService.decide(request.id, userId, true),
    (error) => error?.code === 'TOPUP_MANAGED_BY_PROVIDER',
  );
  const [[wallet]] = await pool.execute('SELECT balance FROM wallets WHERE user_id = ?', [userId]);
  assert.equal(Number(wallet.balance), 350);
  await pool.execute('DELETE FROM wallet_topup_requests WHERE id = ?', [request.id]);
});
