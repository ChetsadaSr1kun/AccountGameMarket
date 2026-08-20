ALTER TABLE users
  ADD COLUMN email_verified_at DATETIME(3) NULL AFTER avatar_url,
  ADD COLUMN phone_verified_at DATETIME(3) NULL AFTER email_verified_at;

CREATE TABLE user_verification_otps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  channel ENUM('EMAIL', 'PHONE') NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  invalidated_at DATETIME(3) NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_user_verification_otps_active (user_id, channel, used_at, invalidated_at, expires_at),
  CONSTRAINT fk_user_verification_otps_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
