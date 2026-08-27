const { pool } = require('../config/database');

async function create(data, executor = pool) {
  const [result] = await executor.execute(
    `INSERT INTO wallet_topup_requests (user_id, payment_method, amount, reference_code)
     VALUES (?, ?, ?, ?)`,
    [data.userId, data.paymentMethod, data.amount, data.referenceCode || null],
  );
  return findById(result.insertId, executor);
}

async function findById(id, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT id, user_id, payment_method, amount, status, reference_code, proof_url,
            reviewed_by, reviewed_at, rejection_reason, created_at, updated_at
     FROM wallet_topup_requests WHERE id = ? LIMIT 1`, [id],
  );
  return rows[0] || null;
}

async function listByUserId(userId, limit = 20, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT id, payment_method, amount, status, reference_code, rejection_reason, created_at
     FROM wallet_topup_requests WHERE user_id = ? ORDER BY id DESC LIMIT ?`,
    [userId, limit],
  );
  return rows;
}

module.exports = { create, findById, listByUserId };