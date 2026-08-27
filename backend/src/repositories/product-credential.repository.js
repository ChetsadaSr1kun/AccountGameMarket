async function findByProductId(productId, executor) {
  const [rows] = await executor.execute(
    `SELECT product_id, game_username_encrypted, game_password_encrypted,
            email_encrypted, email_password_encrypted
     FROM product_credentials WHERE product_id = ? LIMIT 1`,
    [productId],
  );
  return rows[0] || null;
}

async function upsert(productId, data, executor) {
  await executor.execute(
    `INSERT INTO product_credentials
      (product_id, game_username_encrypted, game_password_encrypted, email_encrypted, email_password_encrypted)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      game_username_encrypted = VALUES(game_username_encrypted),
      game_password_encrypted = VALUES(game_password_encrypted),
      email_encrypted = VALUES(email_encrypted),
      email_password_encrypted = VALUES(email_password_encrypted)`,
    [productId, data.gameUsernameEncrypted, data.gamePasswordEncrypted, data.emailEncrypted, data.emailPasswordEncrypted],
  );
}

module.exports = { findByProductId, upsert };