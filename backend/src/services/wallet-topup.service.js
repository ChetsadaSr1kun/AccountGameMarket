const crypto = require('crypto');
const AppError = require('../utils/app-error');
const repository = require('../repositories/wallet-topup.repository');
const walletRepository = require('../repositories/wallet.repository');

const allowedMethods = new Set(['CARD', 'BANK', 'PROMPTPAY', 'TRUEMONEY']);

function mapRequest(row) {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    paymentMethod: row.payment_method,
    amount: Number(row.amount),
    status: row.status,
    referenceCode: row.reference_code,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
  };
}

async function createRequest(userId, paymentMethod, amount) {
  const normalizedMethod = String(paymentMethod || '').toUpperCase();
  const normalizedAmount = Number(amount);
  if (!allowedMethods.has(normalizedMethod)) throw new AppError('Unsupported payment method.', 400, 'INVALID_PAYMENT_METHOD');
  if (!Number.isFinite(normalizedAmount) || normalizedAmount < 10) throw new AppError('Minimum top up amount is 10.', 400, 'INVALID_TOPUP_AMOUNT');
  if (normalizedAmount > 100000) throw new AppError('Top up amount is too high.', 400, 'INVALID_TOPUP_AMOUNT');

  const referenceCode = `TOPUP-DEMO-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const { pool } = require('../config/database');
  const row = await require('../utils/transaction').withTransaction(async (connection) => {
    await walletRepository.ensureWallet(userId, connection);
    const [walletRows] = await connection.execute('SELECT balance FROM wallets WHERE user_id=? FOR UPDATE', [userId]);
    const newBalance = Number(walletRows[0]?.balance || 0) + normalizedAmount;
    await connection.execute('UPDATE wallets SET balance=? WHERE user_id=?', [newBalance, userId]);
    const [result] = await connection.execute(`INSERT INTO wallet_topup_requests
      (user_id,payment_method,amount,status,reference_code,reviewed_at)
      VALUES (?, ?, ?, 'APPROVED', ?, CURRENT_TIMESTAMP(3))`, [userId, normalizedMethod, normalizedAmount, referenceCode]);
    await connection.execute(`INSERT INTO wallet_transactions
      (wallet_user_id,type,amount,balance_after,reference_type,reference_id,note)
      VALUES (?,'TOP_UP',?,?,?,?,?)`, [userId, normalizedAmount, newBalance, 'WALLET_TOPUP', result.insertId, 'Demo top-up: credited immediately']);
    return repository.findById(result.insertId, connection);
  });
  return mapRequest(row);
}

async function listMyRequests(userId) {
  const rows = await repository.listByUserId(userId, 20);
  return rows.map(mapRequest);
}

module.exports = { createRequest, listMyRequests };