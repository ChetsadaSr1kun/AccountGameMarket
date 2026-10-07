ALTER TABLE users
  ADD COLUMN wallet_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN wallet_created_at DATETIME(3) NULL,
  ADD COLUMN wallet_updated_at DATETIME(3) NULL,
  ADD CONSTRAINT chk_user_wallet_nonnegative CHECK (wallet_balance >= 0);
UPDATE users u JOIN wallets w ON w.user_id=u.id
SET u.wallet_balance=w.balance,u.wallet_created_at=w.created_at,u.wallet_updated_at=w.updated_at,
    u.updated_at=u.updated_at;

-- Add the new parent constraint before removing the old one.
ALTER TABLE wallet_transactions
  ADD CONSTRAINT fk_wallet_transactions_user FOREIGN KEY (wallet_user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE wallet_transactions DROP FOREIGN KEY fk_wallet_transactions_wallet;
