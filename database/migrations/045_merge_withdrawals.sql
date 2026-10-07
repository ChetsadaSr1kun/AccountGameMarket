-- Preserve both historical record sets; the old schema has no attempt/request link.
-- Attempt IDs remain the internal IDs so existing OTP references stay unchanged.
CREATE TABLE withdrawals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  record_type VARCHAR(8) NOT NULL,
  legacy_request_id BIGINT UNSIGNED NULL,
  source_attempt_id BIGINT UNSIGNED NULL,
  source_attempt_type VARCHAR(8) NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method ENUM('BANK','PROMPTPAY','TRUEMONEY') NOT NULL,
  bank_code VARCHAR(20) NULL,
  account_name VARCHAR(120) NOT NULL,
  account_number VARCHAR(64) NOT NULL,
  status ENUM('PENDING','COMPLETED','CANCELLED','EXPIRED','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  email_verified_at DATETIME(3) NULL,
  phone_verified_at DATETIME(3) NULL,
  expires_at DATETIME(3) NULL,
  rejection_reason VARCHAR(255) NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_withdrawals_id_type (id,record_type),
  UNIQUE KEY uq_withdrawals_legacy_request (legacy_request_id),
  UNIQUE KEY uq_withdrawals_source_attempt (source_attempt_id),
  KEY idx_withdrawals_user_type_created (user_id,record_type,created_at),
  KEY idx_withdrawals_type_status_created (record_type,status,created_at),
  KEY idx_withdrawals_type_status_expires (record_type,status,expires_at),
  CONSTRAINT fk_withdrawals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_withdrawals_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_withdrawals_source_attempt FOREIGN KEY (source_attempt_id,source_attempt_type)
    REFERENCES withdrawals(id,record_type) ON DELETE SET NULL,
  CONSTRAINT chk_withdrawals_amount CHECK (amount>=100),
  CONSTRAINT chk_withdrawals_type CHECK (
    (record_type='ATTEMPT' AND expires_at IS NOT NULL AND legacy_request_id IS NULL
      AND status IN ('PENDING','COMPLETED','CANCELLED','EXPIRED')
      AND rejection_reason IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (record_type='REQUEST' AND status IN ('PENDING','APPROVED','REJECTED')
      AND expires_at IS NULL AND email_verified_at IS NULL AND phone_verified_at IS NULL)),
  CONSTRAINT chk_withdrawals_source CHECK (
    (source_attempt_id IS NULL AND source_attempt_type IS NULL)
    OR (record_type='REQUEST' AND source_attempt_id IS NOT NULL
      AND source_attempt_type IS NOT NULL AND source_attempt_type='ATTEMPT'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO withdrawals (id,record_type,user_id,amount,payment_method,bank_code,account_name,account_number,
  status,email_verified_at,phone_verified_at,expires_at,created_at,updated_at)
SELECT id,'ATTEMPT',user_id,amount,payment_method,bank_code,account_name,account_number,
  status,email_verified_at,phone_verified_at,expires_at,created_at,updated_at
FROM withdrawal_attempts ORDER BY id;

INSERT INTO withdrawals (record_type,legacy_request_id,user_id,amount,payment_method,bank_code,account_name,
  account_number,status,rejection_reason,reviewed_by,reviewed_at,created_at,updated_at)
SELECT 'REQUEST',id,user_id,amount,payment_method,bank_code,account_name,account_number,
  status,rejection_reason,reviewed_by,reviewed_at,created_at,updated_at
FROM withdrawal_requests ORDER BY id;

-- Future public request IDs cannot collide with any preserved request ID.
SET @withdrawal_next_id=(SELECT GREATEST(COALESCE(MAX(id),0),COALESCE(MAX(legacy_request_id),0))+1 FROM withdrawals);
SET @withdrawal_sequence_sql=CONCAT('ALTER TABLE withdrawals AUTO_INCREMENT=',@withdrawal_next_id);
PREPARE withdrawal_sequence FROM @withdrawal_sequence_sql;
EXECUTE withdrawal_sequence;
DEALLOCATE PREPARE withdrawal_sequence;

-- Install the new FK before retiring the old FK; OTP rows and IDs are unchanged.
ALTER TABLE withdrawal_attempt_otps
  ADD COLUMN withdrawal_record_type VARCHAR(8) NOT NULL DEFAULT 'ATTEMPT',
  ADD CONSTRAINT chk_withdrawal_otp_record_type CHECK (withdrawal_record_type='ATTEMPT'),
  ADD CONSTRAINT fk_withdrawal_otp_storage FOREIGN KEY (withdrawal_attempt_id,withdrawal_record_type)
    REFERENCES withdrawals(id,record_type) ON DELETE CASCADE;
ALTER TABLE withdrawal_attempt_otps DROP FOREIGN KEY fk_withdrawal_attempt_otp_attempt;
