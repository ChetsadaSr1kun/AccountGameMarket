const { pool } = require('../config/database');

async function create(executor, token) {
  await executor.execute(
    `INSERT INTO refresh_tokens
      (user_id, token_id, family_id, token_hash, expires_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [token.userId, token.tokenId, token.familyId, token.tokenHash, token.expiresAt, token.ipAddress, token.userAgent],
  );
}

async function findActiveForUpdate(executor, tokenId) {
  const [rows] = await executor.execute(
    `SELECT * FROM refresh_tokens
     WHERE token_id = ? AND expires_at > UTC_TIMESTAMP(3)
     LIMIT 1 FOR UPDATE`,
    [tokenId],
  );
  return rows[0] || null;
}

async function revokeByTokenId(executor, tokenId, replacedBy = null) {
  await executor.execute(
    'UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(3), replaced_by_token_id = ? WHERE token_id = ? AND revoked_at IS NULL',
    [replacedBy, tokenId],
  );
}

async function revokeFamily(executor, familyId) {
  await executor.execute('UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(3) WHERE family_id = ? AND revoked_at IS NULL', [familyId]);
}

async function revokeAllForUser(executor, userId) {
  await executor.execute('UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(3) WHERE user_id = ? AND revoked_at IS NULL', [userId]);
}

module.exports = { create, findActiveForUpdate, revokeByTokenId, revokeFamily, revokeAllForUser };
