ALTER TABLE users
  ADD COLUMN suspension_reason VARCHAR(500) NULL AFTER status,
  ADD COLUMN suspended_until DATETIME(3) NULL AFTER suspension_reason,
  ADD KEY idx_users_suspension (status, suspended_until);
