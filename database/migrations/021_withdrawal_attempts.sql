CREATE TABLE IF NOT EXISTS withdrawal_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method ENUM('BANK','PROMPTPAY','TRUEMONEY') NOT NULL,
  account_name VARCHAR(120) NOT NULL,
  account_number VARCHAR(64) NOT NULL,
  status ENUM('PENDING','COMPLETED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  email_verified_at DATETIME(3) NULL,
  phone_verified_at DATETIME(3) NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_withdrawal_attempt_user_created (user_id, created_at),
  KEY idx_withdrawal_attempt_status_expires (status, expires_at),
  CONSTRAINT fk_withdrawal_attempt_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_withdrawal_attempt_amount CHECK (amount >= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS withdrawal_attempt_otps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  withdrawal_attempt_id BIGINT UNSIGNED NOT NULL,
  channel ENUM('EMAIL','PHONE') NOT NULL,
  otp_hash CHAR(64) NULL,
  provider_reference VARCHAR(191) NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  invalidated_at DATETIME(3) NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_withdrawal_attempt_otp_channel (withdrawal_attempt_id, channel),
  KEY idx_withdrawal_attempt_otp_active (
    withdrawal_attempt_id,
    channel,
    used_at,
    invalidated_at,
    expires_at
  ),
  CONSTRAINT fk_withdrawal_attempt_otp_attempt
    FOREIGN KEY (withdrawal_attempt_id)
    REFERENCES withdrawal_attempts(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;