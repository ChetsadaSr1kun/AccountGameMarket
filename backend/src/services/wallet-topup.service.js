const crypto = require('node:crypto');
const { withTransaction } = require('../utils/transaction');
const AppError = require('../utils/app-error');
const repository = require('../repositories/wallet-topup.repository');
const walletRepository = require('../repositories/wallet.repository');
const notificationService = require('./notification.service');
const slipOkService = require('./slipok.service');
const config = require('../config/env');

const allowedMethods = new Set(['BANK', 'PROMPTPAY']);

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function matchesMaskedDigits(maskedValue, expectedValue) {
  const masked = String(maskedValue || '').replace(/[^0-9xX*]/g, '');
  const expected = normalizeDigits(expectedValue);
  if (!masked || !expected || masked.length !== expected.length) return false;
  let visibleDigits = 0;
  for (let i = 0; i < masked.length; i += 1) {
    if (/\d/.test(masked[i])) {
      visibleDigits += 1;
      if (masked[i] !== expected[i]) return false;
    }
  }
  return visibleDigits >= 3;
}

function assertReceiverMatches(paymentMethod, receiver) {
  const expectedValue = paymentMethod === 'BANK'
    ? config.slipOk.receiverAccount
    : paymentMethod === 'PROMPTPAY'
      ? config.slipOk.receiverPromptPay
      : config.slipOk.receiverTrueMoney;
  const matched = paymentMethod === 'BANK'
    ? matchesMaskedDigits(receiver?.account?.value, expectedValue)
    : matchesMaskedDigits(receiver?.proxy?.value, expectedValue) || matchesMaskedDigits(receiver?.account?.value, expectedValue);
  if (!matched) {
    throw new AppError('ปลายทางในสลิปไม่ตรงกับบัญชีรับเงินของ GameMarket', 422, 'SLIP_RECEIVER_MISMATCH');
  }
}

function parseDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function assertSlipTimestampFresh(request, transTimestamp) {
  const transactionAt = parseDateTime(transTimestamp);
  if (!transactionAt) {
    throw new AppError('SlipOK ไม่พบเวลาทำรายการที่ตรวจสอบได้จากสลิป', 422, 'SLIP_TIMESTAMP_MISSING');
  }

  const requestCreatedAt = parseDateTime(request.created_at);
  if (!requestCreatedAt) {
    throw new AppError('ไม่สามารถตรวจสอบเวลาสร้างคำขอเติมพ้อยท์ได้', 500, 'TOPUP_TIMESTAMP_INVALID');
  }

  const now = Date.now();
  const allowedPastSkewMs = 5 * 60 * 1000;
  const allowedFutureSkewMs = 2 * 60 * 1000;
  if (transactionAt.getTime() < requestCreatedAt.getTime() - allowedPastSkewMs) {
    throw new AppError('สลิปนี้เกิดขึ้นก่อนคำขอเติมพ้อยท์นานเกินกำหนด', 422, 'SLIP_TIMESTAMP_TOO_OLD');
  }
  if (transactionAt.getTime() > now + allowedFutureSkewMs) {
    throw new AppError('เวลาทำรายการในสลิปอยู่ในอนาคต', 422, 'SLIP_TIMESTAMP_IN_FUTURE');
  }
}

function mapRequest(row) {
  return {
    id: Number(row.id), userId: Number(row.user_id), paymentMethod: row.payment_method, amount: Number(row.amount),
    status: row.status, referenceCode: row.reference_code, provider: row.provider,
    providerStatus: row.provider_status, providerReferenceNo: row.provider_reference_no, providerPaidAt: row.provider_paid_at,
    providerExpiresAt: row.provider_expires_at, slipOkTransRef: row.slipok_trans_ref, slipOkTransTimestamp: row.slipok_trans_timestamp,
    slipOkVerifiedAt: row.slipok_verified_at, rejectionReason: row.rejection_reason, createdAt: row.created_at,
  };
}

async function createRequest(userId, paymentMethod, amount) {
  const normalizedMethod = String(paymentMethod || '').toUpperCase();
  const normalizedAmount = Number(amount);
  if (!allowedMethods.has(normalizedMethod)) throw new AppError('ช่องทางเติมพ้อยท์ไม่ถูกต้อง', 400, 'INVALID_PAYMENT_METHOD');
  if (!Number.isFinite(normalizedAmount) || normalizedAmount < 10) throw new AppError('จำนวนเติมพ้อยท์ขั้นต่ำคือ 10', 400, 'INVALID_TOPUP_AMOUNT');
  if (normalizedAmount > 100000) throw new AppError('จำนวนเติมพ้อยท์สูงเกินกำหนด', 400, 'INVALID_TOPUP_AMOUNT');
  const referenceCode = 'TOPUP-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const providerExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const topup = await repository.create({ userId, paymentMethod: normalizedMethod, amount: normalizedAmount, referenceCode,
    provider: 'SLIPOK', providerStatus: 'AWAITING_SLIP' });
  await repository.updateProviderData(topup.id, { provider: 'SLIPOK', providerChannelCode: normalizedMethod,
    providerStatus: 'AWAITING_SLIP', providerExpiresAt });
  const result = mapRequest(await repository.findById(topup.id));
  result.receiver = {
    name: config.slipOk.receiverName,
    bank: config.slipOk.receiverBank,
    account: config.slipOk.receiverAccount,
    promptPay: config.slipOk.receiverPromptPay,
    trueMoney: config.slipOk.receiverTrueMoney,
  };
  return result;
}

async function processSlipOkVerification(topupId, userId, file) {
  await repository.expireExpiredPendingByUserId(userId);
  const current = await repository.findById(topupId);
  if (!current || Number(current.user_id) !== Number(userId)) throw new AppError('ไม่พบคำขอเติมพ้อยท์', 404, 'TOPUP_NOT_FOUND');
  if (current.provider !== 'SLIPOK') throw new AppError('คำขอนี้ไม่ได้ใช้ SlipOK', 409, 'TOPUP_PROVIDER_MISMATCH');
  if (current.status === 'APPROVED') return { id: Number(current.id), status: 'APPROVED', duplicate: true };
  if (current.provider_status === 'EXPIRED') throw new AppError('คำขอเติมพ้อยท์หมดอายุแล้ว กรุณาสร้างคำขอใหม่', 409, 'TOPUP_EXPIRED');
  if (current.status !== 'PENDING') throw new AppError('คำขอเติมพ้อยท์นี้ไม่อยู่ในสถานะรอตรวจสอบ', 409, 'TOPUP_NOT_PENDING');

  let verification;
  try { verification = await slipOkService.checkSlip({ file, amount: current.amount }); }
  catch (error) {
    await repository.updateProviderResult(current.id, { providerStatus: 'VERIFY_FAILED', providerReferenceNo: null, providerPaidAt: null, status: current.status });
    if (error instanceof AppError) throw error;
    throw new AppError(error?.message || 'SlipOK ตรวจสอบสลิปไม่สำเร็จ', error?.statusCode || 502, 'SLIPOK_VERIFICATION_FAILED');
  }

  const transRef = String(verification.transRef || '').trim();
  if (!transRef) throw new AppError('SlipOK ไม่พบเลขอ้างอิงธุรกรรมจากสลิป', 422, 'SLIPOK_TRANS_REF_MISSING');
  if (Number(verification.amount) !== Number(current.amount)) throw new AppError('จำนวนเงินในสลิปไม่ตรงกับคำขอเติมพ้อยท์', 422, 'SLIP_AMOUNT_MISMATCH');
  assertReceiverMatches(current.payment_method, verification.receiver);
  assertSlipTimestampFresh(current, verification.transTimestamp);
  let transTimestamp = null;
  if (verification.transTimestamp) { const parsed = new Date(verification.transTimestamp); if (!Number.isNaN(parsed.getTime())) transTimestamp = parsed; }

  return withTransaction(async (connection) => {
    const request = await repository.findById(current.id, connection, true);
    if (!request || Number(request.user_id) !== Number(userId)) throw new AppError('ไม่พบคำขอเติมพ้อยท์', 404, 'TOPUP_NOT_FOUND');
    if (request.status === 'APPROVED') return { id: Number(request.id), status: 'APPROVED', duplicate: true };
    if (request.status !== 'PENDING') throw new AppError('คำขอเติมพ้อยท์นี้ไม่อยู่ในสถานะรอตรวจสอบ', 409, 'TOPUP_NOT_PENDING');
    const duplicate = await repository.findBySlipOkTransRef(transRef, connection, true);
    if (duplicate && Number(duplicate.id) !== Number(request.id)) throw new AppError('สลิปนี้ถูกใช้เติมพ้อยท์ไปแล้ว', 409, 'SLIP_ALREADY_USED');
    await walletRepository.ensureWallet(request.user_id, connection);
    const newBalance = await walletRepository.creditBalance(request.user_id, request.amount, connection);
    await connection.execute(`INSERT INTO wallet_transactions (wallet_user_id,type,amount,balance_after,reference_type,reference_id,note)
      VALUES (?,'TOP_UP',?,?,?,?,?)`, [request.user_id, request.amount, newBalance, 'WALLET_TOPUP', request.id, 'เติมพ้อยท์ผ่าน SlipOK #' + request.id]);
    await repository.updateSlipOkResult(request.id, { providerStatus: 'VERIFIED', providerReferenceNo: transRef, providerPaidAt: new Date(), status: 'APPROVED',
      slipokTransRef: transRef, slipokTransTimestamp: transTimestamp, slipokVerifiedAt: new Date() }, connection);
    await notificationService.create({ userId: request.user_id, type: 'WALLET_TOPUP', title: 'เติมพ้อยท์สำเร็จ',
      message: 'เติม ' + Number(request.amount).toLocaleString('en-US') + ' pts เข้ากระเป๋าแล้ว', referenceType: 'WALLET_TOPUP', referenceId: request.id }, connection);
    return { id: Number(request.id), status: 'APPROVED', duplicate: false };
  });
}

async function listMyRequests(userId) { await repository.expireExpiredPendingByUserId(userId); const rows = await repository.listByUserId(userId, 20); return rows.map(mapRequest); }
module.exports = { createRequest, listMyRequests, processSlipOkVerification };
