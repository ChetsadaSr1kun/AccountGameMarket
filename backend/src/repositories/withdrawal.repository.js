const { pool } = require('../config/database');

async function create(data, executor = pool) {
  const [result] = await executor.execute(
    `INSERT INTO withdrawal_requests
      (user_id, amount, payment_method, account_name, account_number)
     VALUES (?, ?, ?, ?, ?)`,
    [data.userId, data.amount, data.paymentMethod, data.accountName, data.accountNumber],
  );
  return findById(result.insertId, executor);
}

async function findById(id, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT id, user_id, amount, payment_method, account_name, account_number,
            status, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at
     FROM withdrawal_requests WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

async function listByUserId(userId, limit = 20, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT id, amount, payment_method, account_name, account_number, status,
            rejection_reason, reviewed_at, created_at
     FROM withdrawal_requests WHERE user_id = ?
     ORDER BY id DESC LIMIT ?`,
    [userId, limit],
  );
  return rows;
}

async function getPendingSummary(userId, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT COALESCE(SUM(amount),0) AS pending_amount,
            COUNT(*) AS pending_count
     FROM withdrawal_requests
     WHERE user_id = ? AND status = 'PENDING'`,
    [userId],
  );
  return {
    pendingAmount: Number(rows[0]?.pending_amount || 0),
    pendingCount: Number(rows[0]?.pending_count || 0),
  };
}

module.exports = { create, findById, listByUserId, getPendingSummary };