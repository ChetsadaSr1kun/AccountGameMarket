const { pool } = require('../config/database');

async function ensureWallet(userId, executor = pool) {
  await executor.execute('INSERT INTO wallets (user_id, balance) VALUES (?, 0) ON DUPLICATE KEY UPDATE user_id = user_id', [userId]);
}

async function findByUserId(userId, executor = pool) {
  const [rows] = await executor.execute('SELECT user_id, balance, created_at, updated_at FROM wallets WHERE user_id = ?', [userId]);
  if (!rows[0]) return null;
  return { userId: Number(rows[0].user_id), balance: Number(rows[0].balance), createdAt: rows[0].created_at, updatedAt: rows[0].updated_at };
}

async function getTotals(userId, executor = pool) {
  const [[topup]] = await executor.execute(
    "SELECT COALESCE(SUM(amount),0) total FROM wallet_topup_requests WHERE user_id=? AND status='APPROVED'",
    [userId],
  );
  const [[withdrawal]] = await executor.execute(
    "SELECT COALESCE(SUM(amount),0) total FROM withdrawal_requests WHERE user_id=? AND status='APPROVED'",
    [userId],
  );
  return { totalTopup: Number(topup?.total || 0), totalWithdrawal: Number(withdrawal?.total || 0) };
}

async function listTransactions(userId, limit = 20, executor = pool) {
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
  const [rows] = await executor.execute(`SELECT wt.id, wt.type, wt.amount, wt.balance_after, wt.reference_type,
    wt.reference_id, wt.note, wt.created_at, tr.payment_method
    FROM wallet_transactions wt
    LEFT JOIN wallet_topup_requests tr
      ON wt.reference_type = 'WALLET_TOPUP' AND tr.id = wt.reference_id
    WHERE wt.wallet_user_id = ?
    ORDER BY wt.id DESC LIMIT ${safeLimit}`, [userId]);
  return rows.map((row) => ({
    id: Number(row.id),
    type: row.type,
    amount: Number(row.amount),
    balanceAfter: Number(row.balance_after),
    referenceType: row.reference_type,
    referenceId: row.reference_id ? Number(row.reference_id) : null,
    note: row.note,
    paymentMethod: row.payment_method || null,
    createdAt: row.created_at,
  }));
}

module.exports = { ensureWallet, findByUserId, getTotals, listTransactions };
async function reserveBalance(userId, amount, executor = pool) {
  const [result] = await executor.execute(
    'UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND balance >= ?',
    [amount, userId, amount],
  );
  return result.affectedRows === 1;
}

async function createTransaction(data, executor = pool) {
  await executor.execute(
    `INSERT INTO wallet_transactions
      (wallet_user_id, type, amount, balance_after, reference_type, reference_id, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.userId, data.type, data.amount, data.balanceAfter,
      data.referenceType || null, data.referenceId || null, data.note || null],
  );
}

module.exports.reserveBalance = reserveBalance;
module.exports.createTransaction = createTransaction;