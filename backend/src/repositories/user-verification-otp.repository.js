'use strict';

async function invalidateActiveForUserChannel(executor, userId, channel) {
  await executor.execute(
    `UPDATE user_verification_otps
       SET invalidated_at = UTC_TIMESTAMP(3)
     WHERE user_id = ? AND channel = ? AND used_at IS NULL AND invalidated_at IS NULL`,
    [userId, channel],
  );
}

async function create(executor, { userId, channel, otpHash, expiresAt }) {
  const [result] = await executor.execute(
    `INSERT INTO user_verification_otps (user_id, channel, otp_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
    [userId, channel, otpHash, expiresAt],
  );
  return result.insertId;
}

async function findLatestActiveForUpdate(executor, userId, channel) {
  const [rows] = await executor.execute(
    `SELECT id, otp_hash, expires_at, attempts
       FROM user_verification_otps
      WHERE user_id = ? AND channel = ? AND used_at IS NULL AND invalidated_at IS NULL
      ORDER BY id DESC
      LIMIT 1 FOR UPDATE`,
    [userId, channel],
  );
  return rows[0] || null;
}

async function incrementAttempts(executor, id) {
  await executor.execute('UPDATE user_verification_otps SET attempts = attempts + 1 WHERE id = ?', [id]);
}

async function markUsed(executor, id) {
  await executor.execute('UPDATE user_verification_otps SET used_at = UTC_TIMESTAMP(3) WHERE id = ?', [id]);
}

async function invalidateById(executor, id) {
  await executor.execute(
    'UPDATE user_verification_otps SET invalidated_at = UTC_TIMESTAMP(3) WHERE id = ? AND used_at IS NULL AND invalidated_at IS NULL',
    [id],
  );
}

module.exports = {
  invalidateActiveForUserChannel,
  create,
  findLatestActiveForUpdate,
  incrementAttempts,
  markUsed,
  invalidateById,
};
