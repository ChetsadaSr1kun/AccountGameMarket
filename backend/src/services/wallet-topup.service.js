const crypto = require('crypto');
const AppError = require('../utils/app-error');
const repository = require('../repositories/wallet-topup.repository');

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

  const referenceCode = `TOPUP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const row = await repository.create({ userId, paymentMethod: normalizedMethod, amount: normalizedAmount, referenceCode });
  return mapRequest(row);
}

async function listMyRequests(userId) {
  const rows = await repository.listByUserId(userId, 20);
  return rows.map(mapRequest);
}

module.exports = { createRequest, listMyRequests };