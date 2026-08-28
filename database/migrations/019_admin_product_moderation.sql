ALTER TABLE products
  ADD COLUMN moderation_reason VARCHAR(500) NULL,
  ADD COLUMN moderated_by BIGINT UNSIGNED NULL,
  ADD COLUMN moderated_at DATETIME(3) NULL,
  ADD KEY idx_products_moderated_by (moderated_by),
  ADD CONSTRAINT fk_products_moderated_by FOREIGN KEY (moderated_by) REFERENCES users (id) ON DELETE SET NULL;
