ALTER TABLE conversations
  MODIFY COLUMN buyer_id BIGINT UNSIGNED NULL,
  MODIFY COLUMN seller_id BIGINT UNSIGNED NULL,
  ADD COLUMN conversation_type ENUM('USER','SUPPORT') NOT NULL DEFAULT 'USER',
  ADD COLUMN legacy_support_id BIGINT UNSIGNED NULL,
  ADD COLUMN support_user_id BIGINT UNSIGNED NULL,
  ADD COLUMN assigned_admin_id BIGINT UNSIGNED NULL,
  ADD COLUMN support_status ENUM('OPEN','CLOSED') NULL,
  ADD COLUMN user_last_read_message_id BIGINT UNSIGNED NULL,
  ADD COLUMN admin_last_read_message_id BIGINT UNSIGNED NULL,
  ADD COLUMN closed_at DATETIME(3) NULL,
  ADD UNIQUE KEY uq_conversations_legacy_support (legacy_support_id),
  ADD UNIQUE KEY uq_conversations_support_user (support_user_id),
  ADD KEY idx_conversations_support_status (conversation_type,support_status,updated_at),
  ADD CONSTRAINT fk_conversations_support_user FOREIGN KEY (support_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_conversations_support_admin FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT chk_conversations_type CHECK (
    (conversation_type='USER' AND buyer_id IS NOT NULL AND seller_id IS NOT NULL
      AND support_user_id IS NULL AND support_status IS NULL AND legacy_support_id IS NULL)
    OR (conversation_type='SUPPORT' AND buyer_id IS NULL AND seller_id IS NULL
      AND product_id IS NULL AND support_user_id IS NOT NULL AND support_status IS NOT NULL));
ALTER TABLE messages
  ADD COLUMN legacy_support_id BIGINT UNSIGNED NULL,
  ADD UNIQUE KEY uq_messages_legacy_support (legacy_support_id);

INSERT INTO conversations (conversation_type,legacy_support_id,support_user_id,assigned_admin_id,support_status,
  user_last_read_message_id,admin_last_read_message_id,created_at,updated_at,closed_at)
SELECT 'SUPPORT',id,user_id,assigned_admin_id,status,user_last_read_message_id,admin_last_read_message_id,
  created_at,updated_at,closed_at FROM support_conversations ORDER BY id;
INSERT INTO messages (conversation_id,sender_id,body,created_at,legacy_support_id)
SELECT c.id,m.sender_id,m.body,m.created_at,m.id FROM support_messages m
JOIN conversations c ON c.legacy_support_id=m.conversation_id AND c.conversation_type='SUPPORT'
ORDER BY m.id;

-- New public support IDs use the new internal ID. Start above all old API IDs.
SET @support_next_conversation = (SELECT GREATEST(COALESCE(MAX(id),0),
  COALESCE(MAX(legacy_support_id),0))+1 FROM conversations);
SET @support_sequence_sql = CONCAT('ALTER TABLE conversations AUTO_INCREMENT=', @support_next_conversation);
PREPARE support_sequence FROM @support_sequence_sql;
EXECUTE support_sequence;
DEALLOCATE PREPARE support_sequence;
SET @support_next_message = (SELECT GREATEST(COALESCE(MAX(id),0),
  COALESCE(MAX(legacy_support_id),0))+1 FROM messages);
SET @support_sequence_sql = CONCAT('ALTER TABLE messages AUTO_INCREMENT=', @support_next_message);
PREPARE support_sequence FROM @support_sequence_sql;
EXECUTE support_sequence;
DEALLOCATE PREPARE support_sequence;
