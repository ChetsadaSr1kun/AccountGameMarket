const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { after, before, test } = require('node:test');

const { pool } = require('../../backend/src/config/database');
const userRepository = require('../../backend/src/repositories/user.repository');
const walletRepository = require('../../backend/src/repositories/wallet.repository');
const topupService = require('../../backend/src/services/wallet-topup.service');
const withdrawalAttemptService = require('../../backend/src/services/withdrawal-attempt.service');
const withdrawalService = require('../../backend/src/services/withdrawal.service');
const emailService = require('../../backend/src/services/email.service');
const smsService = require('../../backend/src/services/sms.service');
const {
  assertTestDatabase,
  closeTestDatabasePool,
  prepareTestDatabase,
} = require('../helpers/test-database');

assertTestDatabase();

const runId = crypto.randomUUID().replaceAll('-', '');
let userId;

before(async () => {
  await prepareTestDatabase();
  userId = await userRepository.create(pool, {
    email: `payment_methods_${runId}@example.test`,
    username: `pay_methods_${runId.slice(0, 18)}`,
    firstName: 'Payment',
    lastName: 'Methods',
    phone: '0812345678',
    dateOfBirth: '2000-01-01',
    passwordHash: 'test-hash',
    accountMode: 'CUSTOMER_ONLY',
  });
});

after(async () => {
  if (userId) {
    await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
  }
  await closeTestDatabasePool();
});

for (const paymentMethod of ['BANK', 'PROMPTPAY']) {
  test(`accepts ${paymentMethod} for new top-up requests`, async () => {
    const request = await topupService.createRequest(userId, paymentMethod, 100);
    assert.equal(request.paymentMethod, paymentMethod);
  });

  test(`accepts ${paymentMethod} for new withdrawal attempts`, async () => {
    const attempt = await withdrawalAttemptService.createAttempt(userId, {
      amount: 100,
      paymentMethod,
      accountName: 'Payment Methods',
      accountNumber: '0812345678',
    });
    assert.equal(attempt.paymentMethod, paymentMethod);
    assert.equal(attempt.status, 'PENDING');
  });
}

test('rejects TRUEMONEY for new top-up requests', async () => {
  await assert.rejects(
    topupService.createRequest(userId, 'TRUEMONEY', 100),
    (error) => error?.code === 'INVALID_PAYMENT_METHOD',
  );
});

test('rejects TRUEMONEY for new withdrawal attempts before OTP', async () => {
  await assert.rejects(
    withdrawalAttemptService.createAttempt(userId, {
      amount: 100,
      paymentMethod: 'TRUEMONEY',
      accountName: 'Payment Methods',
      accountNumber: '0812345678',
    }),
    (error) => error?.code === 'INVALID_WITHDRAWAL_METHOD',
  );
});

test('rejects TRUEMONEY in the final withdrawal creation service', async () => {
  await assert.rejects(
    withdrawalService.createRequest(userId, {
      amount: 100,
      paymentMethod: 'TRUEMONEY',
      accountName: 'Payment Methods',
      accountNumber: '0812345678',
    }),
    (error) => error?.code === 'INVALID_WITHDRAWAL_METHOD',
  );
});

test('completes a BANK withdrawal attempt after the email and phone OTP flow', async () => {
  const originalSendEmailOtp = emailService.sendEmailVerificationOtp;
  const originalSendPhoneOtp = smsService.sendPhoneVerificationOtp;
  const originalCheckPhoneOtp = smsService.checkPhoneVerificationOtp;
  let emailOtp;

  emailService.sendEmailVerificationOtp = async ({ otp }) => {
    emailOtp = otp;
  };
  smsService.sendPhoneVerificationOtp = async () => ({ sid: 'test-withdrawal-otp' });
  smsService.checkPhoneVerificationOtp = async () => ({ status: 'approved' });

  try {
    await walletRepository.ensureWallet(userId);
    await pool.execute('UPDATE wallets SET balance = ? WHERE user_id = ?', [1000, userId]);

    const attempt = await withdrawalAttemptService.createAttempt(userId, {
      amount: 100,
      paymentMethod: 'BANK',
      accountName: 'Payment Methods',
      accountNumber: '0812345678',
    });

    await withdrawalAttemptService.sendEmailOtp(userId, attempt.id);
    assert.match(emailOtp, /^\d{6}$/);
    await withdrawalAttemptService.verifyEmailOtp(userId, attempt.id, emailOtp);
    await withdrawalAttemptService.sendPhoneOtp(userId, attempt.id);
    await withdrawalAttemptService.verifyPhoneOtp(userId, attempt.id, '123456');
    const completed = await withdrawalAttemptService.markCompleted(userId, attempt.id);

    assert.equal(completed.status, 'COMPLETED');
    assert.ok(completed.withdrawalRequestId);

    const requests = await withdrawalService.listMyRequests(userId);
    const request = requests.find((item) => item.id === completed.withdrawalRequestId);
    assert.equal(request?.paymentMethod, 'BANK');
    assert.equal(request?.status, 'PENDING');

    const wallet = await walletRepository.findByUserId(userId);
    assert.equal(Number(wallet.balance), 900);
  } finally {
    emailService.sendEmailVerificationOtp = originalSendEmailOtp;
    smsService.sendPhoneVerificationOtp = originalSendPhoneOtp;
    smsService.checkPhoneVerificationOtp = originalCheckPhoneOtp;
  }
});
