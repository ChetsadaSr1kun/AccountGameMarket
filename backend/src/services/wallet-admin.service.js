const AppError = require('../utils/app-error');
const wallet = require('../repositories/wallet.repository');
const { withTransaction } = require('../utils/transaction');

function map(row) {
  return {
    id: Number(row.id), userId: Number(row.user_id), username: row.username,
    paymentMethod: row.payment_method, amount: Number(row.amount), status: row.status,
    referenceCode: row.reference_code, createdAt: row.created_at,
    rejectionReason: row.rejection_reason,
  };
}

async function listPending() {
  const { pool } = require('../config/database');
  const [rows] = await pool.execute(`SELECT r.id,r.user_id,u.username,r.payment_method,r.amount,
    r.status,r.reference_code,r.created_at,r.rejection_reason FROM wallet_topup_requests r
    INNER JOIN users u ON u.id=r.user_id WHERE r.status='PENDING' ORDER BY r.id ASC`);
  return rows.map(map);
}

async function listTopupHistory(limit = 50) {
  const { pool } = require('../config/database');
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
  const [rows] = await pool.execute(`SELECT r.id,r.user_id,u.username,r.payment_method,r.amount,r.status,r.reference_code,
    r.rejection_reason,r.reviewed_at,r.created_at
    FROM wallet_topup_requests r INNER JOIN users u ON u.id=r.user_id
    ORDER BY r.id DESC LIMIT ${safeLimit}`);
  return rows.map(map);
}

async function getTopupSummary() {
  const { pool } = require('../config/database');
  const [rows] = await pool.execute(`SELECT
    COUNT(*) AS total_count,
    SUM(CASE WHEN status='APPROVED' THEN 1 ELSE 0 END) AS approved_count,
    SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) AS pending_count,
    SUM(CASE WHEN status='REJECTED' THEN 1 ELSE 0 END) AS rejected_count,
    COALESCE(SUM(CASE WHEN status='APPROVED' THEN amount ELSE 0 END),0) AS approved_amount
    FROM wallet_topup_requests`);
  const row = rows[0] || {};
  return {
    totalCount: Number(row.total_count || 0), approvedCount: Number(row.approved_count || 0),
    pendingCount: Number(row.pending_count || 0), rejectedCount: Number(row.rejected_count || 0),
    approvedAmount: Number(row.approved_amount || 0),
  };
}

async function decide(requestId, adminId, approved, reason = null) {
  return withTransaction(async (connection) => {
    const [rows] = await connection.execute('SELECT * FROM wallet_topup_requests WHERE id=? FOR UPDATE', [requestId]);
    const request = rows[0];
    if (!request) throw new AppError('Top-up request not found.', 404, 'TOPUP_NOT_FOUND');
    if (request.status !== 'PENDING') throw new AppError('This top-up request has already been processed.', 409, 'TOPUP_ALREADY_PROCESSED');
    if (!approved && !String(reason || '').trim()) throw new AppError('Rejection reason is required.', 400, 'REJECTION_REASON_REQUIRED');
    if (approved) {
      await wallet.ensureWallet(request.user_id, connection);
      const [walletRows] = await connection.execute('SELECT balance FROM wallets WHERE user_id=? FOR UPDATE', [request.user_id]);
      const newBalance = Number(walletRows[0].balance) + Number(request.amount);
      await connection.execute('UPDATE wallets SET balance=? WHERE user_id=?', [newBalance, request.user_id]);
      await connection.execute(`INSERT INTO wallet_transactions
        (wallet_user_id,type,amount,balance_after,reference_type,reference_id,note)
        VALUES (?,'TOP_UP',?,?,?,?,?)`, [request.user_id, request.amount, newBalance, 'WALLET_TOPUP', request.id, `เติมพ้อยท์ #${request.id}`]);
      await connection.execute(`UPDATE wallet_topup_requests SET status='APPROVED',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP(3) WHERE id=?`, [adminId, request.id]);
    } else {
      await connection.execute(`UPDATE wallet_topup_requests SET status='REJECTED',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP(3),rejection_reason=? WHERE id=?`, [adminId, String(reason).trim(), request.id]);
    }
    return { id: Number(request.id), status: approved ? 'APPROVED' : 'REJECTED' };
  });
}

async function listPendingWithdrawals() {
  const { pool } = require('../config/database');
  const [rows] = await pool.execute(`SELECT r.id,r.user_id,u.username,r.payment_method,r.amount,
    r.account_name,r.account_number,r.status,r.rejection_reason,r.created_at
    FROM withdrawal_requests r INNER JOIN users u ON u.id=r.user_id
    WHERE r.status='PENDING' ORDER BY r.id ASC`);
  return rows.map((row) => ({
    id: Number(row.id), userId: Number(row.user_id), username: row.username,
    paymentMethod: row.payment_method, amount: Number(row.amount),
    accountName: row.account_name, accountNumber: row.account_number,
    status: row.status, rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
  }));
}

async function decideWithdrawal(requestId, adminId, approved, reason = null) {
  return withTransaction(async (connection) => {
    const [rows] = await connection.execute('SELECT * FROM withdrawal_requests WHERE id=? FOR UPDATE', [requestId]);
    const request = rows[0];
    if (!request) throw new AppError('Withdrawal request not found.', 404, 'WITHDRAWAL_NOT_FOUND');
    if (request.status !== 'PENDING') throw new AppError('This withdrawal request has already been processed.', 409, 'WITHDRAWAL_ALREADY_PROCESSED');
    if (!approved && !String(reason || '').trim()) throw new AppError('Rejection reason is required.', 400, 'REJECTION_REASON_REQUIRED');

    if (approved) {
      await connection.execute(`UPDATE withdrawal_requests SET status='APPROVED',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP(3) WHERE id=?`, [adminId, request.id]);
    } else {
      await wallet.ensureWallet(request.user_id, connection);
      const [walletRows] = await connection.execute('SELECT balance FROM wallets WHERE user_id=? FOR UPDATE', [request.user_id]);
      const newBalance = Number(walletRows[0].balance) + Number(request.amount);
      await connection.execute('UPDATE wallets SET balance=? WHERE user_id=?', [newBalance, request.user_id]);
      await connection.execute(`INSERT INTO wallet_transactions
        (wallet_user_id,type,amount,balance_after,reference_type,reference_id,note)
        VALUES (?,'REFUND',?,?,?,?,?)`, [request.user_id, request.amount, newBalance, 'WITHDRAWAL_REQUEST', request.id, 'คืนพ้อยท์จากคำขอถอนที่ไม่อนุมัติ']);
      await connection.execute(`UPDATE withdrawal_requests SET status='REJECTED',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP(3),rejection_reason=? WHERE id=?`, [adminId, String(reason).trim(), request.id]);
    }
    return { id: Number(request.id), status: approved ? 'APPROVED' : 'REJECTED' };
  });
}

module.exports = { listPending, decide, listTopupHistory, getTopupSummary, listPendingWithdrawals, decideWithdrawal };