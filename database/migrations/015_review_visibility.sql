ALTER TABLE reviews
  ADD COLUMN status ENUM('ACTIVE','HIDDEN') NOT NULL DEFAULT 'ACTIVE' AFTER comment,
  ADD KEY idx_reviews_seller_status_created (seller_id, status, created_at);
