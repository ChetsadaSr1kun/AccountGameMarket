CREATE TABLE IF NOT EXISTS support_conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  assigned_admin_id BIGINT UNSIGNED NULL,

  status ENUM(
    'OPEN',
    'CLOSED'
  ) NOT NULL DEFAULT 'OPEN',

  user_last_read_message_id BIGINT UNSIGNED NULL,
  admin_last_read_message_id BIGINT UNSIGNED NULL,

  created_at DATETIME(3)
    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  updated_at DATETIME(3)
    NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  closed_at DATETIME(3) NULL,

  PRIMARY KEY (id),

  UNIQUE KEY uq_support_conversation_user (
    user_id
  ),

  KEY idx_support_conversations_status_updated (
    status,
    updated_at
  ),

  KEY idx_support_conversations_admin (
    assigned_admin_id
  ),

  CONSTRAINT fk_support_conversations_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_support_conversations_admin
    FOREIGN KEY (assigned_admin_id)
    REFERENCES users(id)
    ON DELETE SET NULL
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS support_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_id BIGINT UNSIGNED NOT NULL,

  body VARCHAR(2000) NOT NULL,

  created_at DATETIME(3)
    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),

  KEY idx_support_messages_conversation (
    conversation_id,
    id
  ),

  KEY idx_support_messages_sender (
    sender_id
  ),

  CONSTRAINT fk_support_messages_conversation
    FOREIGN KEY (conversation_id)
    REFERENCES support_conversations(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_support_messages_sender
    FOREIGN KEY (sender_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci; 