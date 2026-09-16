const { pool } = require('../config/database');

async function create(data, executor = pool) {
  const [result] = await executor.execute(
    `INSERT INTO wallet_topup_requests (user_id, payment_method, amount, reference_code, provider, provider_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.userId, data.paymentMethod, data.amount, data.referenceCode || null, data.provider || null, data.providerStatus || null],
  );
  return findById(result.insertId, executor);
}

async function findById(id, executor = pool, forUpdate = false) {
  const [rows] = await executor.execute(
    `SELECT id, user_id, payment_method, amount, status, reference_code,
            provider, provider_invoice_no, provider_payment_token,
            provider_channel_code, provider_payment_url, provider_qr_url,
            provider_status, provider_reference_no, provider_paid_at,
            provider_expires_at, reviewed_by, reviewed_at, rejection_reason,
            slipok_trans_ref, slipok_trans_timestamp, slipok_verified_at,
            created_at, updated_at
     FROM wallet_topup_requests WHERE id = ? LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [id],
  );
  return rows[0] || null;
}

async function listByUserId(userId, limit = 20, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT id, payment_method, amount, status, reference_code,
            provider, provider_invoice_no, provider_channel_code,
            provider_payment_url, provider_qr_url, provider_status,
            provider_reference_no, provider_paid_at, provider_expires_at,
            slipok_trans_ref, slipok_trans_timestamp, slipok_verified_at,
            rejection_reason, created_at
    FROM wallet_topup_requests WHERE user_id = ?
    ORDER BY id DESC LIMIT ?`,
    [userId, limit],
  );
  return rows;
}

async function updateProviderData(id, data, executor = pool) {
  await executor.execute(
    `UPDATE wallet_topup_requests
     SET provider=?, provider_invoice_no=?, provider_payment_token=?, provider_channel_code=?,
         provider_payment_url=?, provider_qr_url=?, provider_status=?, provider_expires_at=?
     WHERE id=?`,
    [data.provider || null, data.providerInvoiceNo || null, data.providerPaymentToken || null,
      data.providerChannelCode || null, data.providerPaymentUrl || null, data.providerQrUrl || null,
      data.providerStatus || null, data.providerExpiresAt || null, id],
  );
  return findById(id, executor);
}

async function findBySlipOkTransRef(transRef, executor = pool, forUpdate = false) {
  const [rows] = await executor.execute(
    `SELECT * FROM wallet_topup_requests WHERE provider='SLIPOK' AND slipok_trans_ref=? LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [transRef],
  );
  return rows[0] || null;
}
async function updateSlipOkResult(id, data, executor = pool) {
  await executor.execute(
    `UPDATE wallet_topup_requests
     SET provider='SLIPOK', provider_status=?, provider_reference_no=?, provider_paid_at=?, status=?,
         slipok_trans_ref=?, slipok_trans_timestamp=?, slipok_verified_at=?,
         reviewed_at=CASE WHEN ?='APPROVED' THEN CURRENT_TIMESTAMP(3) ELSE reviewed_at END
     WHERE id=?`,
    [data.providerStatus || null, data.providerReferenceNo || null, data.providerPaidAt || null, data.status,
      data.slipokTransRef || null, data.slipokTransTimestamp || null, data.slipokVerifiedAt || null, data.status, id],
  );
  return findById(id, executor);
}

async function updateProviderResult(id, data, executor = pool) {
  await executor.execute(
    `UPDATE wallet_topup_requests
     SET provider_status=?, provider_reference_no=?, provider_paid_at=?, status=?,
         reviewed_at=CASE WHEN ?='APPROVED' THEN CURRENT_TIMESTAMP(3) ELSE reviewed_at END
     WHERE id=?`,
    [data.providerStatus || null, data.providerReferenceNo || null, data.providerPaidAt || null, data.status, data.status, id],
  );
  return findById(id, executor);
}

module.exports = { create, findById, findBySlipOkTransRef, updateProviderData, updateProviderResult, updateSlipOkResult, listByUserId };
