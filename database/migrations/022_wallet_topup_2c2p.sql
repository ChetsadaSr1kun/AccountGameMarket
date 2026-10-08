SET @db_name = DATABASE();

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = @db_name
      AND table_name = 'wallet_topup_requests'
      AND column_name = 'provider'
  ),
  'SELECT 1',
  'ALTER TABLE wallet_topup_requests ADD COLUMN provider VARCHAR(30) NULL AFTER reference_code'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = @db_name
      AND table_name = 'wallet_topup_requests'
      AND column_name = 'provider_invoice_no'
  ),
  'SELECT 1',
  'ALTER TABLE wallet_topup_requests ADD COLUMN provider_invoice_no VARCHAR(20) NULL AFTER provider'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = @db_name
      AND table_name = 'wallet_topup_requests'
      AND column_name = 'provider_payment_token'
  ),
  'SELECT 1',
  'ALTER TABLE wallet_topup_requests ADD COLUMN provider_payment_token TEXT NULL AFTER provider_invoice_no'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = @db_name
      AND table_name = 'wallet_topup_requests'
      AND column_name = 'provider_channel_code'
  ),
  'SELECT 1',
  'ALTER TABLE wallet_topup_requests ADD COLUMN provider_channel_code VARCHAR(30) NULL AFTER provider_payment_token'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = @db_name
      AND table_name = 'wallet_topup_requests'
      AND column_name = 'provider_payment_url'
  ),
  'SELECT 1',
  'ALTER TABLE wallet_topup_requests ADD COLUMN provider_payment_url TEXT NULL AFTER provider_channel_code'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = @db_name
      AND table_name = 'wallet_topup_requests'
      AND column_name = 'provider_qr_url'
  ),
  'SELECT 1',
  'ALTER TABLE wallet_topup_requests ADD COLUMN provider_qr_url TEXT NULL AFTER provider_payment_url'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = @db_name
      AND table_name = 'wallet_topup_requests'
      AND column_name = 'provider_status'
  ),
  'SELECT 1',
  'ALTER TABLE wallet_topup_requests ADD COLUMN provider_status VARCHAR(30) NULL AFTER provider_qr_url'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = @db_name
      AND table_name = 'wallet_topup_requests'
      AND column_name = 'provider_reference_no'
  ),
  'SELECT 1',
  'ALTER TABLE wallet_topup_requests ADD COLUMN provider_reference_no VARCHAR(100) NULL AFTER provider_status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = @db_name
      AND table_name = 'wallet_topup_requests'
      AND column_name = 'provider_paid_at'
  ),
  'SELECT 1',
  'ALTER TABLE wallet_topup_requests ADD COLUMN provider_paid_at DATETIME(3) NULL AFTER provider_reference_no'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = @db_name
      AND table_name = 'wallet_topup_requests'
      AND column_name = 'provider_expires_at'
  ),
  'SELECT 1',
  'ALTER TABLE wallet_topup_requests ADD COLUMN provider_expires_at DATETIME(3) NULL AFTER provider_paid_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @db_name = DATABASE();

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = @db_name
      AND table_name = 'wallet_topup_requests'
      AND index_name = 'uq_wallet_topup_provider_invoice'
  ),
  'SELECT 1',
  'ALTER TABLE wallet_topup_requests ADD UNIQUE KEY uq_wallet_topup_provider_invoice (provider, provider_invoice_no)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;