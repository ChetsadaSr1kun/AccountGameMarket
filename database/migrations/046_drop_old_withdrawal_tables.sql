-- Run only with application writes stopped and after repository/test verification.
CREATE TEMPORARY TABLE withdrawal_drop_guard (mismatches BIGINT NOT NULL CHECK (mismatches=0));
INSERT INTO withdrawal_drop_guard SELECT COUNT(*) FROM withdrawal_attempts s
LEFT JOIN withdrawals w ON w.record_type='ATTEMPT' AND w.id=s.id
WHERE w.id IS NULL OR NOT (
  BINARY s.user_id <=> BINARY w.user_id
  AND BINARY s.amount <=> BINARY w.amount
  AND BINARY s.payment_method <=> BINARY w.payment_method
  AND BINARY s.bank_code <=> BINARY w.bank_code
  AND BINARY s.account_name <=> BINARY w.account_name
  AND BINARY s.account_number <=> BINARY w.account_number
  AND BINARY s.status <=> BINARY w.status
  AND BINARY s.created_at <=> BINARY w.created_at
  AND BINARY s.updated_at <=> BINARY w.updated_at
  AND BINARY s.email_verified_at <=> BINARY w.email_verified_at
  AND BINARY s.phone_verified_at <=> BINARY w.phone_verified_at
  AND BINARY s.expires_at <=> BINARY w.expires_at);
INSERT INTO withdrawal_drop_guard SELECT ABS(
  (SELECT COUNT(*) FROM withdrawal_attempts)-(SELECT COUNT(*) FROM withdrawals WHERE record_type='ATTEMPT'));
INSERT INTO withdrawal_drop_guard SELECT COUNT(*) FROM withdrawal_requests s
LEFT JOIN withdrawals w ON w.record_type='REQUEST' AND w.legacy_request_id=s.id
WHERE w.id IS NULL OR NOT (
  BINARY s.user_id <=> BINARY w.user_id
  AND BINARY s.amount <=> BINARY w.amount
  AND BINARY s.payment_method <=> BINARY w.payment_method
  AND BINARY s.bank_code <=> BINARY w.bank_code
  AND BINARY s.account_name <=> BINARY w.account_name
  AND BINARY s.account_number <=> BINARY w.account_number
  AND BINARY s.status <=> BINARY w.status
  AND BINARY s.created_at <=> BINARY w.created_at
  AND BINARY s.updated_at <=> BINARY w.updated_at
  AND BINARY s.rejection_reason <=> BINARY w.rejection_reason
  AND BINARY s.reviewed_by <=> BINARY w.reviewed_by
  AND BINARY s.reviewed_at <=> BINARY w.reviewed_at);
INSERT INTO withdrawal_drop_guard SELECT ABS(
  (SELECT COUNT(*) FROM withdrawal_requests)-(SELECT COUNT(*) FROM withdrawals WHERE record_type='REQUEST'));
INSERT INTO withdrawal_drop_guard SELECT COUNT(*) FROM withdrawal_attempt_otps o
LEFT JOIN withdrawals w ON w.id=o.withdrawal_attempt_id AND w.record_type='ATTEMPT'
WHERE w.id IS NULL;
DROP TABLE withdrawal_attempts;
DROP TABLE withdrawal_requests;
DROP TEMPORARY TABLE withdrawal_drop_guard;
