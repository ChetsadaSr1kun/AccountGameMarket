async function invalidateUnusedForUser(executor, userId) {
  await executor.execute('UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP(3) WHERE user_id = ? AND used_at IS NULL', [userId]);
}

async function create(executor, { userId, tokenHash, expiresAt }) {
  await executor.execute('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [userId, tokenHash, expiresAt]);
}

async function findActiveForUpdate(executor, tokenHash) {
  const [rows] = await executor.execute(
    `SELECT * FROM password_reset_tokens
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP(3)
     LIMIT 1 FOR UPDATE`,
    [tokenHash],
  );
  return rows[0] || null;
}

async function markUsed(executor, tokenId) {
  await executor.execute('UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP(3) WHERE id = ?', [tokenId]);
}

module.exports = { invalidateUnusedForUser, create, findActiveForUpdate, markUsed };
