ALTER TABLE reviews
  ADD COLUMN seller_reply TEXT NULL AFTER comment,
  ADD COLUMN seller_reply_at DATETIME NULL AFTER seller_reply;
