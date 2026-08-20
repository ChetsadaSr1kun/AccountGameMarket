ALTER TABLE users
  ADD COLUMN date_of_birth DATE NULL AFTER phone,
  ADD COLUMN avatar_url VARCHAR(500) NULL AFTER date_of_birth;
