const { supportConversations, supportMessages } = require('./chat-storage');
const { pool } =
  require('../config/database');


async function findById(
  conversationId,
  executor = pool
) {
  const [rows] =
    await executor.execute(
      `
      SELECT
        sc.id,
        sc.user_id,
        sc.assigned_admin_id,
        sc.status,
        sc.user_last_read_message_id,
        sc.admin_last_read_message_id,
        sc.created_at,
        sc.updated_at,
        sc.closed_at,

        u.username AS user_username,
        u.avatar_url AS user_avatar,

        admin.username AS assigned_admin_username

      FROM ${supportConversations} sc

      INNER JOIN users u
        ON u.id = sc.user_id

      LEFT JOIN users admin
        ON admin.id = sc.assigned_admin_id

      WHERE sc.id = ?

      LIMIT 1
      `,
      [conversationId]
    );

  return rows[0] || null;
}


async function findByUserId(
  userId,
  executor = pool
) {
  const [rows] =
    await executor.execute(
      `
      SELECT
        sc.id,
        sc.user_id,
        sc.assigned_admin_id,
        sc.status,
        sc.user_last_read_message_id,
        sc.admin_last_read_message_id,
        sc.created_at,
        sc.updated_at,
        sc.closed_at,

        u.username AS user_username,
        u.avatar_url AS user_avatar,

        admin.username AS assigned_admin_username

      FROM ${supportConversations} sc

      INNER JOIN users u
        ON u.id = sc.user_id

      LEFT JOIN users admin
        ON admin.id = sc.assigned_admin_id

      WHERE sc.user_id = ?

      LIMIT 1
      `,
      [userId]
    );

  return rows[0] || null;
}


async function findOrCreateForUser(
  userId,
  executor = pool
) {
  const existing =
    await findByUserId(
      userId,
      executor
    );

  if (existing) {
    return existing;
  }

  try {
    const [result] =
      await executor.execute(
        `
        INSERT INTO conversations (conversation_type,support_user_id,support_status) VALUES ('SUPPORT',?,'OPEN')
        `,
        [userId]
      );

    return findById(
      result.insertId,
      executor
    );

  } catch (error) {
    /*
     * ป้องกันกรณี request สองตัว
     * สร้างห้องของ User เดียวกันพร้อมกัน
     */
    if (error?.code === 'ER_DUP_ENTRY') {
      return findByUserId(
        userId,
        executor
      );
    }

    throw error;
  }
}


async function listMessages(
  conversationId,
  limit = 100,
  executor = pool
) {
  const safeLimit =
    Math.min(
      Math.max(
        Number(limit) || 100,
        1
      ),
      200
    );

  const [rows] =
    await executor.execute(
      `
      SELECT
        sm.id,
        sm.conversation_id,
        sm.sender_id,
        sm.body,
        sm.created_at,

        u.username AS sender_username,
        u.avatar_url AS sender_avatar

      FROM ${supportMessages} sm

      INNER JOIN users u
        ON u.id = sm.sender_id

      WHERE sm.conversation_id = ?

      ORDER BY
        sm.created_at ASC,
        sm.id ASC

      LIMIT ?
      `,
      [
        conversationId,
        safeLimit,
      ]
    );

  return rows;
}


async function createMessage(
  conversationId,
  senderId,
  body,
  executor = pool
) {
  const [result] =
    await executor.execute(
      `
      INSERT INTO messages (conversation_id,sender_id,body)
      VALUES ((SELECT id FROM conversations WHERE conversation_type='SUPPORT' AND COALESCE(legacy_support_id,id)=?),?,?)
      `,
      [
        conversationId,
        senderId,
        body,
      ]
    );

  await executor.execute(
    `
    UPDATE conversations
    SET updated_at = UTC_TIMESTAMP(3)
    WHERE conversation_type='SUPPORT' AND COALESCE(legacy_support_id,id) = ?
    `,
    [conversationId]
  );

  const [rows] =
    await executor.execute(
      `
      SELECT
        sm.id,
        sm.conversation_id,
        sm.sender_id,
        sm.body,
        sm.created_at,

        u.username AS sender_username,
        u.avatar_url AS sender_avatar

      FROM ${supportMessages} sm

      INNER JOIN users u
        ON u.id = sm.sender_id

      WHERE sm.id = ?

      LIMIT 1
      `,
      [result.insertId]
    );

  return rows[0] || null;
}

async function listForAdmin(
  executor = pool
) {
  const [rows] =
    await executor.execute(
      `
      SELECT
        sc.id,
        sc.user_id,
        sc.assigned_admin_id,
        sc.status,
        sc.created_at,
        sc.updated_at,

        u.username AS user_username,
        u.avatar_url AS user_avatar,

        admin.username
          AS assigned_admin_username,

        (
          SELECT sm.body
          FROM ${supportMessages} sm
          WHERE sm.conversation_id = sc.id
          ORDER BY sm.id DESC
          LIMIT 1
        ) AS last_message,

        (
          SELECT sm.created_at
          FROM ${supportMessages} sm
          WHERE sm.conversation_id = sc.id
          ORDER BY sm.id DESC
          LIMIT 1
        ) AS last_message_at,

        (
          SELECT COUNT(*)
          FROM ${supportMessages} sm
          WHERE sm.conversation_id = sc.id
            AND sm.sender_id = sc.user_id
            AND sm.id >
              COALESCE(
                sc.admin_last_read_message_id,
                0
              )
        ) AS unread_count

      FROM ${supportConversations} sc

      INNER JOIN users u
        ON u.id = sc.user_id

      LEFT JOIN users admin
        ON admin.id =
          sc.assigned_admin_id

      ORDER BY
        COALESCE(
          last_message_at,
          sc.updated_at
        ) DESC,
        sc.id DESC
      `
    );

  return rows;
}

async function getUserUnreadCount(
  userId,
  executor = pool
) {
  const [rows] =
    await executor.execute(
      `
      SELECT
        COUNT(sm.id) AS unread_count

      FROM ${supportConversations} sc

      LEFT JOIN ${supportMessages} sm
        ON sm.conversation_id = sc.id
        AND sm.sender_id <> sc.user_id
        AND sm.id >
          COALESCE(
            sc.user_last_read_message_id,
            0
          )

      WHERE sc.user_id = ?
      `,
      [userId]
    );

  return Number(
    rows[0]?.unread_count || 0
  );
}

async function markUserRead(
  conversationId,
  userId,
  executor = pool
) {
  const [result] =
    await executor.execute(
      `
      UPDATE conversations
      SET user_last_read_message_id = (
        SELECT MAX(sm.id)
        FROM ${supportMessages} sm
        WHERE sm.conversation_id = ?
      )
      WHERE conversation_type='SUPPORT' AND COALESCE(legacy_support_id,id) = ?
        AND support_user_id = ?
      `,
      [
        conversationId,
        conversationId,
        userId,
      ]
    );

  return result.affectedRows === 1;
}

async function markAdminRead(
  conversationId,
  executor = pool
) {
  const [result] =
    await executor.execute(
      `
      UPDATE conversations
      SET admin_last_read_message_id = (
        SELECT MAX(sm.id)
        FROM ${supportMessages} sm
        WHERE sm.conversation_id = ?
      )
      WHERE conversation_type='SUPPORT' AND COALESCE(legacy_support_id,id) = ?
      `,
      [
        conversationId,
        conversationId,
      ]
    );

  return result.affectedRows === 1;
}

module.exports = {
  findById,
  findByUserId,
  findOrCreateForUser,
  listMessages,
  createMessage,
  listForAdmin,
  getUserUnreadCount,
  markUserRead,
  markAdminRead,
};