const AppError = require('../utils/app-error');
const { withTransaction } = require('../utils/transaction');
const withdrawalRepository = require('../repositories/withdrawal.repository');
const walletRepository = require('../repositories/wallet.repository');

const allowedMethods = new Set(['BANK', 'PROMPTPAY', 'TRUEMONEY']);

function mapRequest(row) {
  return {
    id: Number(row.id),
    userId: row.user_id ? Number(row.user_id) : undefined,
    amount: Number(row.amount),
    paymentMethod: row.payment_method,
    accountName: row.account_name,
    accountNumber: row.account_number,
    status: row.status,
    rejectionReason: row.rejection_reason || null,
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at,
  };
}

async function createRequest(userId, data) {
  const amount = Number(data.amount);
  const paymentMethod = String(data.paymentMethod || '').toUpperCase();
  const accountName = String(data.accountName || '').trim();
  const accountNumber = String(data.accountNumber || '').trim();

  if (!Number.isFinite(amount) || amount < 100) {
    throw new AppError('Minimum withdrawal amount is 100.', 400, 'INVALID_WITHDRAWAL_AMOUNT');
  }
  if (amount > 100000) throw new AppError('Withdrawal amount is too high.', 400, 'INVALID_WITHDRAWAL_AMOUNT');
  if (!allowedMethods.has(paymentMethod)) throw new AppError('Unsupported withdrawal method.', 400, 'INVALID_WITHDRAWAL_METHOD');
  if (!accountName || !accountNumber) throw new AppError('Account information is required.', 400, 'INVALID_WITHDRAWAL_ACCOUNT');

  return withTransaction(async (connection) => {
    await walletRepository.ensureWallet(userId, connection);
    const reserved = await walletRepository.reserveBalance(userId, amount, connection);
    if (!reserved) throw new AppError('Insufficient wallet balance.', 400, 'INSUFFICIENT_BALANCE');

    const wallet = await walletRepository.findByUserId(userId, connection);
    const request = await withdrawalRepository.create(
      { userId, amount, paymentMethod, accountName, accountNumber },
      connection,
    );
    await walletRepository.createTransaction({
      userId,
      type: 'WITHDRAWAL',
      amount: -amount,
      balanceAfter: wallet.balance,
      referenceType: 'WITHDRAWAL_REQUEST',
      referenceId: Number(request.id),
      note: 'Withdrawal request pending review',
    }, connection);
    return mapRequest(request);
  });
}

async function listMyRequests(userId) {
  const rows = await withdrawalRepository.listByUserId(userId, 20);
  return rows.map(mapRequest);
}

module.exports = { createRequest, listMyRequests };