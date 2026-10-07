const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { after, before, test } = require('node:test');

const config = require('../../backend/src/config/env');
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
const testReceiverAccount = '1234567890';
const testReceiverPromptPay = '0812345678';
function mask(value, visibleStart = 3, visibleEnd = 4) {
  const digits = String(value).replace(/\D/g, '');
  return `${digits.slice(0, visibleStart)}xxx${digits.slice(-visibleEnd)}`;
}

function matchingReceiver(paymentMethod) {
  if (paymentMethod === 'BANK') return { account: { value: mask(testReceiverAccount) } };
  return { proxy: { value: mask(testReceiverPromptPay) } };
}

function freshTimestamp(offsetMs = 1000) {
  return new Date(Date.now() - offsetMs).toISOString();
}

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

test('auto-expires an expired SlipOK request before slip verification', async () => {
  const request = await topupService.createRequest(userId, 'BANK', 100);
  await pool.execute(
    'UPDATE wallet_topup_requests SET provider_expires_at = ? WHERE id = ?',
    [new Date(Date.now() - 1000), request.id],
  );

  await assert.rejects(
    topupService.processSlipOkVerification(request.id, userId, { buffer: Buffer.from('fake'), mimetype: 'image/png', originalname: 'slip.png' }),
    (error) => error?.code === 'TOPUP_EXPIRED',
  );

  const [[row]] = await pool.execute(
    'SELECT status, provider_status, rejection_reason FROM wallet_topup_requests WHERE id = ?',
    [request.id],
  );
  assert.equal(row.status, 'REJECTED');
  assert.equal(row.provider_status, 'EXPIRED');
  assert.equal(row.rejection_reason, 'คำขอเติมพ้อยท์หมดอายุแล้ว');
  await pool.execute('DELETE FROM wallet_topup_requests WHERE id = ?', [request.id]);
});

test('lists expired SlipOK requests as rejected', async () => {
  const request = await topupService.createRequest(userId, 'PROMPTPAY', 100);
  await pool.execute(
    'UPDATE wallet_topup_requests SET provider_expires_at = ? WHERE id = ?',
    [new Date(Date.now() - 1000), request.id],
  );

  const requests = await topupService.listMyRequests(userId);
  const expired = requests.find((item) => item.id === request.id);
  assert.equal(expired.status, 'REJECTED');
  assert.equal(expired.providerStatus, 'EXPIRED');
  await pool.execute('DELETE FROM wallet_topup_requests WHERE id = ?', [request.id]);
});

test('credits a verified SlipOK slip once and creates its wallet notification', async () => {
  const request = await topupService.createRequest(userId, 'BANK', 250);
  const originalCheckSlip = slipOkService.checkSlip;
  const originalReceiverAccount = config.slipOk.receiverAccount;
  slipOkService.checkSlip = async () => ({
    success: true,
    amount: 250,
    transRef: 'SLIP-UNIQUE-250',
    transTimestamp: freshTimestamp(),
    receiver: matchingReceiver('BANK'),
  });
  config.slipOk.receiverAccount = testReceiverAccount;

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

    const [[wallet]] = await pool.execute('SELECT wallet_balance balance FROM users WHERE id = ?', [userId]);
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
    config.slipOk.receiverAccount = originalReceiverAccount;
  }
});


test('rejects a SlipOK slip when the receiver does not match the configured bank account', async () => {
  const request = await topupService.createRequest(userId, 'BANK', 100);
  const originalCheckSlip = slipOkService.checkSlip;
  const originalReceiverAccount = config.slipOk.receiverAccount;
  slipOkService.checkSlip = async () => ({ success: true, amount: 100, transRef: 'SLIP-WRONG-RECEIVER', receiver: { account: { value: '987xxx3210' } } });
  config.slipOk.receiverAccount = testReceiverAccount;
  try {
    await assert.rejects(topupService.processSlipOkVerification(request.id, userId, { buffer: Buffer.from('fake'), mimetype: 'image/png', originalname: 'slip.png' }), (error) => error?.code === 'SLIP_RECEIVER_MISMATCH');
    const [[wallet]] = await pool.execute('SELECT wallet_balance balance FROM users WHERE id = ?', [userId]);
    assert.equal(Number(wallet.balance), 250);
  } finally {
    slipOkService.checkSlip = originalCheckSlip;
    config.slipOk.receiverAccount = originalReceiverAccount;
    await pool.execute('DELETE FROM wallet_topup_requests WHERE id = ?', [request.id]);
  }
});

test('rejects a SlipOK slip when the PromptPay receiver does not match', async () => {
  const request = await topupService.createRequest(userId, 'PROMPTPAY', 100);
  const originalCheckSlip = slipOkService.checkSlip;
  const originalReceiverPromptPay = config.slipOk.receiverPromptPay;
  slipOkService.checkSlip = async () => ({ success: true, amount: 100, transRef: 'SLIP-WRONG-PROMPTPAY', receiver: { proxy: { value: '099xxx4321' } } });
  config.slipOk.receiverPromptPay = testReceiverPromptPay;
  try {
    await assert.rejects(topupService.processSlipOkVerification(request.id, userId, { buffer: Buffer.from('fake'), mimetype: 'image/png', originalname: 'slip.png' }), (error) => error?.code === 'SLIP_RECEIVER_MISMATCH');
  } finally {
    slipOkService.checkSlip = originalCheckSlip;
    config.slipOk.receiverPromptPay = originalReceiverPromptPay;
    await pool.execute('DELETE FROM wallet_topup_requests WHERE id = ?', [request.id]);
  }
});

test('rejects reuse of the same SlipOK transaction reference on another request', async () => {
  const requestA = await topupService.createRequest(userId, 'BANK', 100);
  const requestB = await topupService.createRequest(userId, 'BANK', 100);
  const originalCheckSlip = slipOkService.checkSlip;
  const originalReceiverAccount = config.slipOk.receiverAccount;
  slipOkService.checkSlip = async () => ({ success: true, amount: 100, transRef: 'SLIP-DUPLICATE-1', transTimestamp: freshTimestamp(), receiver: matchingReceiver('BANK') });
  config.slipOk.receiverAccount = testReceiverAccount;

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
    config.slipOk.receiverAccount = originalReceiverAccount;
    await pool.execute('DELETE FROM wallet_topup_requests WHERE id = ?', [requestB.id]);
    await pool.execute('DELETE FROM wallet_topup_requests WHERE id = ?', [requestA.id]);
  }
});

test('rejects a SlipOK slip that is older than the top-up request window', async () => {
  const request = await topupService.createRequest(userId, 'BANK', 100);
  const originalCheckSlip = slipOkService.checkSlip;
  const originalReceiverAccount = config.slipOk.receiverAccount;
  slipOkService.checkSlip = async () => ({
    success: true,
    amount: 100,
    transRef: 'SLIP-TOO-OLD',
    transTimestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    receiver: matchingReceiver('BANK'),
  });
  config.slipOk.receiverAccount = testReceiverAccount;
  try {
    await assert.rejects(
      topupService.processSlipOkVerification(request.id, userId, { buffer: Buffer.from('fake'), mimetype: 'image/png', originalname: 'slip.png' }),
      (error) => error?.code === 'SLIP_TIMESTAMP_TOO_OLD',
    );
    const [[wallet]] = await pool.execute('SELECT wallet_balance balance FROM users WHERE id = ?', [userId]);
    assert.equal(Number(wallet.balance), 350);
  } finally {
    slipOkService.checkSlip = originalCheckSlip;
    config.slipOk.receiverAccount = originalReceiverAccount;
    await pool.execute('DELETE FROM wallet_topup_requests WHERE id = ?', [request.id]);
  }
});

test('rejects a SlipOK slip with a future transaction timestamp', async () => {
  const request = await topupService.createRequest(userId, 'BANK', 100);
  const originalCheckSlip = slipOkService.checkSlip;
  const originalReceiverAccount = config.slipOk.receiverAccount;
  slipOkService.checkSlip = async () => ({
    success: true,
    amount: 100,
    transRef: 'SLIP-FUTURE',
    transTimestamp: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    receiver: matchingReceiver('BANK'),
  });
  config.slipOk.receiverAccount = testReceiverAccount;
  try {
    await assert.rejects(
      topupService.processSlipOkVerification(request.id, userId, { buffer: Buffer.from('fake'), mimetype: 'image/png', originalname: 'slip.png' }),
      (error) => error?.code === 'SLIP_TIMESTAMP_IN_FUTURE',
    );
    const [[wallet]] = await pool.execute('SELECT wallet_balance balance FROM users WHERE id = ?', [userId]);
    assert.equal(Number(wallet.balance), 350);
  } finally {
    slipOkService.checkSlip = originalCheckSlip;
    config.slipOk.receiverAccount = originalReceiverAccount;
    await pool.execute('DELETE FROM wallet_topup_requests WHERE id = ?', [request.id]);
  }
});
test('does not allow legacy admin crediting for a SlipOK-managed request', async () => {
  const request = await topupService.createRequest(userId, 'BANK', 100);
  await assert.rejects(
    walletAdminService.decide(request.id, userId, true),
    (error) => error?.code === 'TOPUP_MANAGED_BY_PROVIDER',
  );
  const [[wallet]] = await pool.execute('SELECT wallet_balance balance FROM users WHERE id = ?', [userId]);
  assert.equal(Number(wallet.balance), 350);
  await pool.execute('DELETE FROM wallet_topup_requests WHERE id = ?', [request.id]);
});
