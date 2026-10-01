'use strict';

const { pool } = require('../config/database');

async function createAttempt(data, executor = pool) {
  const [result] = await executor.execute(
    `INSERT INTO withdrawal_attempts
      (
        user_id,
        amount,
        payment_method,
        bank_code,
        account_name,
        account_number,
        expires_at
      )
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.userId,
      data.amount,
      data.paymentMethod,
      data.bankCode,
      data.accountName,
      data.accountNumber,
      data.expiresAt,
    ],
  );

  return findById(result.insertId, executor);
}

async function findById(id, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT id, user_id, amount, payment_method, bank_code, account_name, account_number,
            status, email_verified_at, phone_verified_at,
            expires_at, created_at, updated_at
       FROM withdrawal_attempts
      WHERE id = ?
      LIMIT 1`,
    [id],
  );

  return rows[0] || null;
}

async function findByIdForUpdate(id, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT id, user_id, amount, payment_method, bank_code, account_name, account_number,
            status, email_verified_at, phone_verified_at,
            expires_at, created_at, updated_at
       FROM withdrawal_attempts
      WHERE id = ?
      LIMIT 1
      FOR UPDATE`,
    [id],
  );

  return rows[0] || null;
}

async function createOrReplaceOtp(executor, data) {
  await executor.execute(
    `INSERT INTO withdrawal_attempt_otps
      (
        withdrawal_attempt_id,
        channel,
        otp_hash,
        provider_reference,
        expires_at,
        used_at,
        invalidated_at,
        attempts
      )
     VALUES (?, ?, ?, ?, ?, NULL, NULL, 0)
     ON DUPLICATE KEY UPDATE
       otp_hash = VALUES(otp_hash),
       provider_reference = VALUES(provider_reference),
       expires_at = VALUES(expires_at),
       used_at = NULL,
       invalidated_at = NULL,
       attempts = 0`,
    [
      data.withdrawalAttemptId,
      data.channel,
      data.otpHash || null,
      data.providerReference || null,
      data.expiresAt,
    ],
  );

  return findOtpByAttemptAndChannel(
    data.withdrawalAttemptId,
    data.channel,
    executor,
  );
}

async function findOtpByAttemptAndChannel(
  withdrawalAttemptId,
  channel,
  executor = pool,
) {
  const [rows] = await executor.execute(
    `SELECT id, withdrawal_attempt_id, channel,
            otp_hash, provider_reference, expires_at,
            used_at, invalidated_at, attempts, created_at
       FROM withdrawal_attempt_otps
      WHERE withdrawal_attempt_id = ?
        AND channel = ?
      LIMIT 1`,
    [withdrawalAttemptId, channel],
  );

  return rows[0] || null;
}

async function findActiveOtpForUpdate(
  withdrawalAttemptId,
  channel,
  executor = pool,
) {
  const [rows] = await executor.execute(
    `SELECT id, withdrawal_attempt_id, channel,
            otp_hash, provider_reference, expires_at,
            used_at, invalidated_at, attempts, created_at
       FROM withdrawal_attempt_otps
      WHERE withdrawal_attempt_id = ?
        AND channel = ?
        AND used_at IS NULL
        AND invalidated_at IS NULL
      LIMIT 1
      FOR UPDATE`,
    [withdrawalAttemptId, channel],
  );

  return rows[0] || null;
}

async function incrementOtpAttempts(id, executor = pool) {
  await executor.execute(
    `UPDATE withdrawal_attempt_otps
        SET attempts = attempts + 1
      WHERE id = ?`,
    [id],
  );
}

async function markOtpUsed(id, executor = pool) {
  await executor.execute(
    `UPDATE withdrawal_attempt_otps
        SET used_at = UTC_TIMESTAMP(3)
      WHERE id = ?
        AND used_at IS NULL
        AND invalidated_at IS NULL`,
    [id],
  );
}

async function invalidateOtp(id, executor = pool) {
  await executor.execute(
    `UPDATE withdrawal_attempt_otps
        SET invalidated_at = UTC_TIMESTAMP(3)
      WHERE id = ?
        AND used_at IS NULL
        AND invalidated_at IS NULL`,
    [id],
  );
}

async function markEmailVerified(attemptId, executor = pool) {
  await executor.execute(
    `UPDATE withdrawal_attempts
        SET email_verified_at = UTC_TIMESTAMP(3),
            updated_at = UTC_TIMESTAMP(3)
      WHERE id = ?`,
    [attemptId],
  );

  return findById(attemptId, executor);
}

async function markPhoneVerified(attemptId, executor = pool) {
  await executor.execute(
    `UPDATE withdrawal_attempts
        SET phone_verified_at = UTC_TIMESTAMP(3),
            updated_at = UTC_TIMESTAMP(3)
      WHERE id = ?`,
    [attemptId],
  );

  return findById(attemptId, executor);
}

async function completeAttempt(attemptId, executor = pool) {
  await executor.execute(
    `UPDATE withdrawal_attempts
        SET status = 'COMPLETED',
            updated_at = UTC_TIMESTAMP(3)
      WHERE id = ?
        AND status = 'PENDING'
        AND email_verified_at IS NOT NULL
        AND phone_verified_at IS NOT NULL`,
    [attemptId],
  );

  return findById(attemptId, executor);
}

async function cancelAttempt(attemptId, executor = pool) {
  await executor.execute(
    `UPDATE withdrawal_attempts
        SET status = 'CANCELLED',
            updated_at = UTC_TIMESTAMP(3)
      WHERE id = ?
        AND status = 'PENDING'`,
    [attemptId],
  );

  return findById(attemptId, executor);
}

async function expireAttempt(attemptId, executor = pool) {
  await executor.execute(
    `UPDATE withdrawal_attempts
        SET status = 'EXPIRED',
            updated_at = UTC_TIMESTAMP(3)
      WHERE id = ?
        AND status = 'PENDING'
        AND expires_at <= UTC_TIMESTAMP(3)`,
    [attemptId],
  );

  return findById(attemptId, executor);
}

module.exports = {
  createAttempt,
  findById,
  findByIdForUpdate,
  createOrReplaceOtp,
  findOtpByAttemptAndChannel,
  findActiveOtpForUpdate,
  incrementOtpAttempts,
  markOtpUsed,
  invalidateOtp,
  markEmailVerified,
  markPhoneVerified,
  completeAttempt,
  cancelAttempt,
  expireAttempt,
};