/*
 * 1) Add normalized participant columns.
 *
 * MariaDB calculates these automatically
 * from buyer_id and seller_id.
 *
 * This guarantees that:
 * 15 <-> 16
 * and
 * 16 <-> 15
 *
 * always resolve to the same pair.
 */

ALTER TABLE conversations

  ADD COLUMN participant_low_id
    BIGINT UNSIGNED
    AS (
      LEAST(
        buyer_id,
        seller_id
      )
    )
    PERSISTENT
    AFTER seller_id,

  ADD COLUMN participant_high_id
    BIGINT UNSIGNED
    AS (
      GREATEST(
        buyer_id,
        seller_id
      )
    )
    PERSISTENT
    AFTER participant_low_id;

/*
 * 3) Build a temporary map for duplicate rooms.
 *
 * The oldest conversation id becomes the keeper.
 */

CREATE TEMPORARY TABLE
  tmp_chat_conversation_merge
(
  old_id BIGINT UNSIGNED NOT NULL,
  keep_id BIGINT UNSIGNED NOT NULL,

  PRIMARY KEY (old_id)
)
ENGINE = MEMORY;


INSERT INTO
  tmp_chat_conversation_merge (
    old_id,
    keep_id
  )
SELECT
  c.id,
  keeper.keep_id
FROM conversations c

INNER JOIN (
  SELECT
    participant_low_id,
    participant_high_id,
    MIN(id) AS keep_id

  FROM conversations

  GROUP BY
    participant_low_id,
    participant_high_id
) keeper
  ON keeper.participant_low_id =
       c.participant_low_id

 AND keeper.participant_high_id =
       c.participant_high_id

WHERE c.id <> keeper.keep_id;


/*
 * 4) Move old messages into the keeper room.
 */

UPDATE messages m

INNER JOIN tmp_chat_conversation_merge merge_map
  ON merge_map.old_id =
     m.conversation_id

SET
  m.conversation_id =
    merge_map.keep_id;


/*
 * 5) Remap old CHAT notifications.
 *
 * Notifications store conversation ids
 * without a foreign key, so these must
 * be updated manually before deleting
 * duplicate rooms.
 */

UPDATE notifications n

INNER JOIN tmp_chat_conversation_merge merge_map
  ON merge_map.old_id =
     n.reference_id

SET
  n.reference_id =
    merge_map.keep_id

WHERE
  n.reference_type = 'CHAT';


/*
 * 6) Remove duplicate conversations.
 *
 * Their messages and notifications
 * have already been moved.
 */

DELETE c
FROM conversations c

INNER JOIN tmp_chat_conversation_merge merge_map
  ON merge_map.old_id = c.id;


/*
 * 7) Recalculate conversation activity time
 * from the latest remaining message.
 */

UPDATE conversations c

LEFT JOIN (
  SELECT
    conversation_id,
    MAX(created_at) AS last_message_at

  FROM messages

  GROUP BY conversation_id
) latest
  ON latest.conversation_id = c.id

SET
  c.updated_at =
    COALESCE(
      latest.last_message_at,
      c.updated_at
    );


/*
 * 8) Replace old product-based uniqueness
 * with one-room-per-user-pair uniqueness.
 */

ALTER TABLE conversations

  DROP INDEX
    uq_conversation_participants_product,

  ADD UNIQUE KEY
    uq_conversation_participants (
      participant_low_id,
      participant_high_id
    ),

  ADD KEY
    idx_conversation_participant_low_updated (
      participant_low_id,
      updated_at
    ),

  ADD KEY
    idx_conversation_participant_high_updated (
      participant_high_id,
      updated_at
    );

/*
 * 9) Read state for User <-> User chat.
 *
 * Each participant stores the latest
 * message that they have read.
 */

CREATE TABLE
  conversation_read_states
(
  conversation_id
    BIGINT UNSIGNED NOT NULL,

  user_id
    BIGINT UNSIGNED NOT NULL,

  last_read_message_id
    BIGINT UNSIGNED NULL,

  updated_at
    DATETIME(3)
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (
    conversation_id,
    user_id
  ),

  KEY idx_conversation_read_user (
    user_id,
    updated_at
  ),

  CONSTRAINT
    fk_conversation_read_conversation
    FOREIGN KEY (
      conversation_id
    )
    REFERENCES conversations(id)
    ON DELETE CASCADE,

  CONSTRAINT
    fk_conversation_read_user
    FOREIGN KEY (
      user_id
    )
    REFERENCES users(id)
    ON DELETE RESTRICT
)
ENGINE = InnoDB
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci;


/*
 * 10) Existing messages are considered read.
 *
 * This prevents old historical messages
 * from suddenly appearing as unread after
 * Chat V2 is enabled.
 */

INSERT INTO conversation_read_states (
  conversation_id,
  user_id,
  last_read_message_id
)
SELECT
  c.id,
  c.participant_low_id,
  MAX(m.id)

FROM conversations c

LEFT JOIN messages m
  ON m.conversation_id = c.id

GROUP BY
  c.id,
  c.participant_low_id

ON DUPLICATE KEY UPDATE
  last_read_message_id =
    VALUES(last_read_message_id);


INSERT INTO conversation_read_states (
  conversation_id,
  user_id,
  last_read_message_id
)
SELECT
  c.id,
  c.participant_high_id,
  MAX(m.id)

FROM conversations c

LEFT JOIN messages m
  ON m.conversation_id = c.id

GROUP BY
  c.id,
  c.participant_high_id

ON DUPLICATE KEY UPDATE
  last_read_message_id =
    VALUES(last_read_message_id);


DROP TEMPORARY TABLE
  tmp_chat_conversation_merge;
