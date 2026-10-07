const { userConversations, userMessages } = require('./chat-storage');
const { pool } = require('../config/database');

async function getStats() {
  const [[products]] = await pool.execute("SELECT COUNT(*) total FROM products WHERE status IN ('ACTIVE','PUBLISHED')");
  const [[users]] = await pool.execute("SELECT COUNT(*) total FROM users WHERE status <> 'DELETED'");
  const [[sales]] = await pool.execute("SELECT COUNT(*) total FROM orders WHERE status IN ('PAID','COMPLETED')");
  return { products: Number(products.total), users: Number(users.total), successfulPurchases: Number(sales.total) };
}

async function getUserHome(userId) {
  userId = Number(userId);

  const [[wallet]] =
    await pool.execute(
      `
        SELECT wallet_balance balance
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId]
    );

  const [[purchases]] =
    await pool.execute(
      `
        SELECT COUNT(*) total
        FROM orders
        WHERE buyer_id = ?
          AND status IN ('PAID', 'COMPLETED')
      `,
      [userId]
    );

  const [[listings]] =
    await pool.execute(
      `
        SELECT COUNT(*) total
        FROM products
        WHERE seller_id = ?
          AND status IN ('ACTIVE', 'PUBLISHED')
      `,
      [userId]
    );

  const [messages] =
    await pool.execute(
      `
        SELECT
          c.id,
          c.product_id,

          p.title product_title,

          u.username other_username,
          u.avatar_url other_avatar,

          (
            SELECT m.body
            FROM ${userMessages} m
            WHERE m.conversation_id = c.id
            ORDER BY
              m.created_at DESC,
              m.id DESC
            LIMIT 1
          ) last_message,

          (
            SELECT m.created_at
            FROM ${userMessages} m
            WHERE m.conversation_id = c.id
            ORDER BY
              m.created_at DESC,
              m.id DESC
            LIMIT 1
          ) last_message_at,

          (
            SELECT COUNT(*)
            FROM ${userMessages} unread

            WHERE
              unread.conversation_id = c.id

              AND unread.sender_id <> ?

              AND unread.id >
                COALESCE(
                  crs.last_read_message_id,
                  0
                )
          ) unread_count

        FROM ${userConversations} c

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

        LIMIT 3
      `,
      [
        userId,
        userId,
        userId,
        userId,
        userId,
      ]
    );

  return {
    wallet:
      Number(wallet?.balance || 0),

    purchases:
      Number(purchases.total),

    listings:
      Number(listings.total),

    messages:
      messages.length,

    recentMessages:
      messages.map((message) => ({
        id:
          Number(message.id),

        otherUsername:
          message.other_username,

        otherAvatar:
          message.other_avatar,

        lastMessage:
          message.last_message ||
          'ยังไม่มีข้อความ',

        lastMessageAt:
          message.last_message_at,

        productTitle:
          message.product_title || null,

        unreadCount:
          Number(
            message.unread_count || 0
          ),
      })),
  };
}

module.exports = { getStats, getUserHome };
