const { pool } = require('../config/database');

async function findOrCreateConversation(
  buyerId,
  sellerId,
  productId = null
) {
  buyerId = Number(buyerId);
  sellerId = Number(sellerId);

  const findExisting = async () => {
    const [rows] =
      await pool.execute(
        `
          SELECT
            id,
            buyer_id,
            seller_id,
            product_id,
            created_at,
            updated_at

          FROM conversations

          WHERE
            (
              buyer_id = ?
              AND seller_id = ?
            )
            OR
            (
              buyer_id = ?
              AND seller_id = ?
            )

          ORDER BY id ASC
          LIMIT 1
        `,
        [
          buyerId,
          sellerId,
          sellerId,
          buyerId,
        ]
      );

    return rows[0] || null;
  };

  const existing =
    await findExisting();

  if (existing) {
    return existing;
  }

  try {
    const [result] =
      await pool.execute(
        `
          INSERT INTO conversations (
            buyer_id,
            seller_id,
            product_id
          )
          VALUES (?, ?, ?)
        `,
        [
          buyerId,
          sellerId,
          productId,
        ]
      );

    const [created] =
      await pool.execute(
        `
          SELECT
            id,
            buyer_id,
            seller_id,
            product_id,
            created_at,
            updated_at

          FROM conversations

          WHERE id = ?
          LIMIT 1
        `,
        [result.insertId]
      );

    return created[0];

  } catch (error) {
    /*
     * After Chat V2 migration, the database
     * guarantees one room per user pair.
     *
     * If two requests try to create the same
     * room at the same time, return the room
     * that won the race.
     */
    if (error?.code === 'ER_DUP_ENTRY') {
      const conversation =
        await findExisting();

      if (conversation) {
        return conversation;
      }
    }

    throw error;
  }
}

async function listForUser(userId) {
  userId = Number(userId);

  const [rows] =
    await pool.execute(
      `
        SELECT
          c.id,
          c.product_id,
          c.updated_at,

          p.title product_title,

          u.id other_user_id,
          u.username other_username,
          u.avatar_url other_avatar,

          (
            SELECT m.body
            FROM messages m
            WHERE m.conversation_id = c.id
            ORDER BY
              m.created_at DESC,
              m.id DESC
            LIMIT 1
          ) last_message,

          (
            SELECT m.created_at
            FROM messages m
            WHERE m.conversation_id = c.id
            ORDER BY
              m.created_at DESC,
              m.id DESC
            LIMIT 1
          ) last_message_at,

          (
            SELECT COUNT(*)
            FROM messages unread

            WHERE
              unread.conversation_id = c.id

              AND unread.sender_id <> ?

              AND unread.id >
                COALESCE(
                  crs.last_read_message_id,
                  0
                )
          ) unread_count

        FROM conversations c

        LEFT JOIN products p
          ON p.id = c.product_id

        JOIN users u
          ON u.id =
            CASE
              WHEN c.buyer_id = ?
                THEN c.seller_id
              ELSE c.buyer_id
            END

        LEFT JOIN conversation_read_states crs
          ON crs.conversation_id = c.id
          AND crs.user_id = ?

        WHERE
          c.buyer_id = ?
          OR c.seller_id = ?

        ORDER BY
          COALESCE(
            last_message_at,
            c.updated_at
          ) DESC,
          c.id DESC
      `,
      [
        userId,
        userId,
        userId,
        userId,
        userId,
      ]
    );

  return rows;
}

async function countUnreadForUser(
  userId
) {
  userId =
    Number(userId);

  const [rows] =
    await pool.execute(
      `
        SELECT
          COUNT(*) unread_count

        FROM conversations c

        JOIN messages m
          ON m.conversation_id = c.id

        LEFT JOIN conversation_read_states crs
          ON crs.conversation_id = c.id
          AND crs.user_id = ?

        WHERE
          (
            c.buyer_id = ?
            OR c.seller_id = ?
          )

          AND m.sender_id <> ?

          AND m.id >
            COALESCE(
              crs.last_read_message_id,
              0
            )
      `,
      [
        userId,
        userId,
        userId,
        userId,
      ]
    );

  return Number(
    rows[0]?.unread_count || 0
  );
}

async function getForUser(conversationId,userId) {
  const [rows] = await pool.execute(`SELECT c.id,c.buyer_id,c.seller_id,c.product_id,p.title product_title,
    bu.username buyer_username,su.username seller_username
    FROM conversations c LEFT JOIN products p ON p.id=c.product_id
    JOIN users bu ON bu.id=c.buyer_id JOIN users su ON su.id=c.seller_id
    WHERE c.id=? AND (c.buyer_id=? OR c.seller_id=?) LIMIT 1`,[conversationId,userId,userId]);
  return rows[0] || null;
}

async function findConversationBetweenUsers(
  userAId,
  userBId,
  executor = pool
) {
  const firstUserId =
    Number(userAId);

  const secondUserId =
    Number(userBId);

  if (
    !Number.isInteger(firstUserId) ||
    firstUserId <= 0 ||
    !Number.isInteger(secondUserId) ||
    secondUserId <= 0 ||
    firstUserId === secondUserId
  ) {
    return null;
  }

  const participantLowId =
    Math.min(
      firstUserId,
      secondUserId
    );

  const participantHighId =
    Math.max(
      firstUserId,
      secondUserId
    );

  const [rows] =
    await executor.execute(
      `
        SELECT
          id,
          buyer_id,
          seller_id,
          product_id,
          participant_low_id,
          participant_high_id,
          created_at,
          updated_at

        FROM conversations

        WHERE
          participant_low_id = ?
          AND participant_high_id = ?

        LIMIT 1
      `,
      [
        participantLowId,
        participantHighId,
      ]
    );

  return rows[0] || null;
}

async function listMessages(conversationId, limit=100) {
  const [rows] = await pool.execute(`SELECT m.id,m.sender_id,u.username sender_username,u.avatar_url sender_avatar,m.body,m.created_at
    FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=? ORDER BY m.created_at ASC,m.id ASC LIMIT ?`,[conversationId,limit]);
  return rows;
}

async function listRecentMessagesForAdmin(
  conversationId,
  limit = 200,
  executor = pool
) {
  const safeConversationId =
    Number(conversationId);

  const safeLimit =
    Math.min(
      Math.max(
        Number(limit) || 200,
        1
      ),
      500
    );

  if (
    !Number.isInteger(
      safeConversationId
    ) ||
    safeConversationId <= 0
  ) {
    return [];
  }

  const [rows] =
    await executor.execute(
      `
        SELECT
          m.id,
          m.conversation_id,
          m.sender_id,

          u.username
            sender_username,

          u.avatar_url
            sender_avatar,

          m.body,
          m.created_at

        FROM messages m

        INNER JOIN users u
          ON u.id = m.sender_id

        WHERE
          m.conversation_id = ?

        ORDER BY
          m.created_at DESC,
          m.id DESC

        LIMIT ?
      `,
      [
        safeConversationId,
        safeLimit,
      ]
    );

  /*
   * Query newest messages first so LIMIT
   * returns the latest messages.
   * Reverse them before returning so the UI
   * renders oldest -> newest like a chat.
   */
  return rows.reverse();
}

async function markConversationRead(
  conversationId,
  userId
) {
  conversationId =
    Number(conversationId);

  userId =
    Number(userId);

  const [rows] =
    await pool.execute(
      `
        SELECT MAX(id) last_message_id
        FROM messages
        WHERE conversation_id = ?
      `,
      [conversationId]
    );

  const lastMessageId =
    rows[0]?.last_message_id == null
      ? null
      : Number(
          rows[0].last_message_id
        );

  await pool.execute(
    `
      INSERT INTO conversation_read_states (
        conversation_id,
        user_id,
        last_read_message_id
      )
      VALUES (?, ?, ?)

      ON DUPLICATE KEY UPDATE
        last_read_message_id =
          VALUES(last_read_message_id),
        updated_at =
          UTC_TIMESTAMP(3)
    `,
    [
      conversationId,
      userId,
      lastMessageId,
    ]
  );

  return lastMessageId;
}

async function createMessage(
  conversationId,
  senderId,
  body
) {
  const [result] =
    await pool.execute(
      `
        INSERT INTO messages (
          conversation_id,
          sender_id,
          body
        )
        VALUES (?, ?, ?)
      `,
      [
        conversationId,
        senderId,
        body,
      ]
    );

  await pool.execute(
    `
      UPDATE conversations
      SET updated_at = UTC_TIMESTAMP(3)
      WHERE id = ?
    `,
    [conversationId]
  );

  const [rows] =
    await pool.execute(
      `
        SELECT
          m.id,
          m.sender_id,
          u.username sender_username,
          u.avatar_url sender_avatar,
          m.body,
          m.created_at

        FROM messages m

        JOIN users u
          ON u.id = m.sender_id

        WHERE m.id = ?
        LIMIT 1
      `,
      [result.insertId]
    );

  return rows[0];
}

async function listAdmin(limit=100) {
  const [rows] = await pool.execute(`SELECT m.id,m.conversation_id,m.sender_id,u.username sender_username,m.body,m.created_at,
    c.product_id,p.title product_title,bu.username buyer_username,su.username seller_username
    FROM messages m JOIN users u ON u.id=m.sender_id JOIN conversations c ON c.id=m.conversation_id
    JOIN users bu ON bu.id=c.buyer_id JOIN users su ON su.id=c.seller_id LEFT JOIN products p ON p.id=c.product_id
    ORDER BY m.created_at DESC,m.id DESC LIMIT ?`,[limit]);
  return rows;
}

module.exports = {
  findOrCreateConversation,
  listForUser,
  countUnreadForUser,
  getForUser,
  findConversationBetweenUsers,
  listMessages,
  listRecentMessagesForAdmin,
  markConversationRead,
  createMessage,
  listAdmin,
};