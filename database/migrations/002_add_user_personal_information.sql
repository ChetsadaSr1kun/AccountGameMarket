ALTER TABLE users
  ADD COLUMN first_name VARCHAR(100) NULL AFTER username,
  ADD COLUMN last_name VARCHAR(100) NULL AFTER first_name,
  ADD COLUMN phone VARCHAR(32) NULL AFTER last_name;
