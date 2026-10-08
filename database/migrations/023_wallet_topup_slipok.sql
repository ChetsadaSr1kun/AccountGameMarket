SET @db_name = DATABASE();

SET @sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = @db_name AND table_name = 'wallet_topup_requests' AND column_name = 'slipok_trans_ref'
  ),
  'SELECT 1',
  'ALTER TABLE wallet_topup_requests ADD COLUMN slipok_trans_ref VARCHAR(100) NULL AFTER provider_reference_no'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = @db_name AND table_name = 'wallet_topup_requests' AND column_name = 'slipok_trans_timestamp'
  ),
  'SELECT 1',
  'ALTER TABLE wallet_topup_requests ADD COLUMN slipok_trans_timestamp DATETIME(3) NULL AFTER slipok_trans_ref'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = @db_name AND table_name = 'wallet_topup_requests' AND column_name = 'slipok_verified_at'
  ),
  'SELECT 1',
  'ALTER TABLE wallet_topup_requests ADD COLUMN slipok_verified_at DATETIME(3) NULL AFTER slipok_trans_timestamp'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = @db_name AND table_name = 'wallet_topup_requests' AND index_name = 'uq_wallet_topup_slipok_trans_ref'
  ),
  'SELECT 1',
  'ALTER TABLE wallet_topup_requests ADD UNIQUE KEY uq_wallet_topup_slipok_trans_ref (provider, slipok_trans_ref)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
