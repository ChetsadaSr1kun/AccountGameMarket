CREATE TEMPORARY TABLE wallet_drop_guard (mismatches BIGINT NOT NULL CHECK (mismatches=0));
INSERT INTO wallet_drop_guard SELECT COUNT(*) FROM wallets w LEFT JOIN users u ON u.id=w.user_id
WHERE u.id IS NULL OR NOT (w.balance <=> u.wallet_balance)
  OR NOT (w.created_at <=> u.wallet_created_at) OR NOT (w.updated_at <=> u.wallet_updated_at);
DROP TABLE wallets;
DROP TEMPORARY TABLE wallet_drop_guard;
