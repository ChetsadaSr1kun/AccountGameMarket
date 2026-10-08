ALTER TABLE withdrawal_attempts
  ADD COLUMN bank_code VARCHAR(20) NULL
  AFTER payment_method;

ALTER TABLE withdrawal_requests
  ADD COLUMN bank_code VARCHAR(20) NULL
  AFTER payment_method;