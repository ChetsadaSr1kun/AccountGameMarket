SET @db_name = DATABASE();

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = @db_name
      AND table_name = 'wallet_topup_requests'
      AND column_name = 'proof_url'
  ),
  'ALTER TABLE wallet_topup_requests DROP COLUMN proof_url',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
