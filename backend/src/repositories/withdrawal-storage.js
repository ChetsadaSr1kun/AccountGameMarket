// Explicit projection preserves the existing request contract and public IDs.
// Locking reads must target withdrawals directly, not this derived table.
const requestColumns = `COALESCE(legacy_request_id,id) id,user_id,amount,payment_method,bank_code,
  account_name,account_number,status,rejection_reason,reviewed_by,reviewed_at,created_at,updated_at`;
const withdrawalRequests = `(SELECT ${requestColumns} FROM withdrawals WHERE record_type='REQUEST')`;

module.exports = { requestColumns, withdrawalRequests };
