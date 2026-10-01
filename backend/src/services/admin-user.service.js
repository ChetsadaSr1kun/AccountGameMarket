const AppError = require('../utils/app-error');
const { pool } = require('../config/database');

function mapUser(row) {
  return {
    id: Number(row.id), username: row.username, email: row.email,
    firstName: row.first_name, lastName: row.last_name, phone: row.phone,
    accountMode: row.account_mode, status: row.status,
    emailVerified: Boolean(row.email_verified_at), phoneVerified: Boolean(row.phone_verified_at),
    createdAt: row.created_at, roles: row.role_codes ? row.role_codes.split(',') : [],
    walletBalance: Number(row.wallet_balance || 0),
    soldCount: Number(row.sold_count || 0), boughtCount: Number(row.bought_count || 0),
  };
}

async function listUsers(search = '', status = 'ALL', role = 'ALL') {
  const params = [];
  const where = [];
  if (search) { where.push('(u.username LIKE ? OR u.email LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (status !== 'ALL') { where.push('u.status = ?'); params.push(status); }
  const roleJoin = role !== 'ALL' ? 'INNER JOIN user_roles ur_filter ON ur_filter.user_id=u.id INNER JOIN roles r_filter ON r_filter.id=ur_filter.role_id AND r_filter.code=?' : '';
  if (role !== 'ALL') params.unshift(role);
  const sql = `SELECT u.id,u.username,u.email,u.first_name,u.last_name,u.phone,u.account_mode,u.status,u.email_verified_at,u.phone_verified_at,u.created_at,
    (SELECT GROUP_CONCAT(DISTINCT r.code ORDER BY r.id SEPARATOR ',') FROM user_roles ur INNER JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id) role_codes,
    COALESCE((SELECT w.balance FROM wallets w WHERE w.user_id=u.id),0) wallet_balance,
    (SELECT COUNT(*) FROM orders o WHERE o.seller_id=u.id AND o.status='COMPLETED') sold_count,
    (SELECT COUNT(*) FROM orders o WHERE o.buyer_id=u.id AND o.status='COMPLETED') bought_count
    FROM users u ${roleJoin} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200`;
  const [rows] = await pool.execute(sql, params);
  return rows.map(mapUser);
}

async function getUser(userId) {
  const id = Number(userId);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new AppError(
      'Invalid user id.',
      400,
      'INVALID_USER_ID'
    );
  }


  /* =========================
     Main account
     ========================= */

  const [rows] = await pool.execute(
    `
    SELECT
      u.id,
      u.username,
      u.email,
      u.first_name,
      u.last_name,
      u.phone,
      u.date_of_birth,
      u.avatar_url,
      u.account_mode,
      u.status,
      u.suspension_reason,
      u.suspended_until,
      u.email_verified_at,
      u.phone_verified_at,
      u.created_at,

      (
        SELECT MAX(rt.created_at)
        FROM refresh_tokens rt
        WHERE rt.user_id = u.id
      ) AS last_session_at,

      (
        SELECT GROUP_CONCAT(
          DISTINCT r.code
          ORDER BY r.id
          SEPARATOR ','
        )
        FROM user_roles ur
        INNER JOIN roles r
          ON r.id = ur.role_id
        WHERE ur.user_id = u.id
      ) AS role_codes,

      COALESCE(
        (
          SELECT w.balance
          FROM wallets w
          WHERE w.user_id = u.id
        ),
        0
      ) AS wallet_balance,

      (
        SELECT COUNT(*)
        FROM orders o
        WHERE
          o.seller_id = u.id
          AND o.status = 'COMPLETED'
      ) AS sold_count,

      (
        SELECT COUNT(*)
        FROM orders o
        WHERE
          o.buyer_id = u.id
          AND o.status = 'COMPLETED'
      ) AS bought_count

    FROM users u

    WHERE u.id = ?

    LIMIT 1
    `,
    [id]
  );

  const row = rows[0];

  if (!row) {
    throw new AppError(
      'User not found.',
      404,
      'USER_NOT_FOUND'
    );
  }

  const user = mapUser(row);


  /* =========================
     Extra real DB data
     ========================= */

  const [
    [verificationRows],
    [salesRows],
    [reviewSummaryRows],
    [walletRows],
    [productRows],
    [purchaseRows],
    [reviewRows],
  ] = await Promise.all([

    /* Seller verification */

    pool.execute(
      `
      SELECT
        status,
        reviewed_at,
        created_at
      FROM seller_verification_requests
      WHERE user_id = ?
      LIMIT 1
      `,
      [id]
    ),


    /* Seller sales */

    pool.execute(
      `
      SELECT
        COUNT(*) AS completed_sales,
        COALESCE(SUM(amount), 0) AS total_sales_amount
      FROM orders
      WHERE
        seller_id = ?
        AND status = 'COMPLETED'
      `,
      [id]
    ),


    /* Seller review summary */

    pool.execute(
      `
      SELECT
        COUNT(*) AS review_count,
        COALESCE(AVG(rating), 0) AS average_rating
      FROM reviews
      WHERE
        seller_id = ?
        AND status = 'ACTIVE'
      `,
      [id]
    ),


    /* Wallet */

    pool.execute(
      `
      SELECT

        COALESCE(
          (
            SELECT SUM(amount)
            FROM wallet_transactions
            WHERE
              wallet_user_id = ?
              AND type = 'SALE'
          ),
          0
        ) AS sale_income,

        COALESCE(
          (
            SELECT SUM(amount)
            FROM withdrawal_requests
            WHERE
              user_id = ?
              AND status = 'APPROVED'
          ),
          0
        ) AS total_withdrawal
      `,
      [id, id]
    ),


    /* Recent products */

    pool.execute(
      `
      SELECT
        p.id,
        p.title,
        p.price,
        p.status,
        p.created_at,
        g.name AS game_name,

        (
          SELECT pi.image_url
          FROM product_images pi
          WHERE pi.product_id = p.id
          ORDER BY
            pi.is_primary DESC,
            pi.sort_order ASC,
            pi.id ASC
          LIMIT 1
        ) AS image_url

      FROM products p

      INNER JOIN games g
        ON g.id = p.game_id

      WHERE p.seller_id = ?

      ORDER BY
        p.created_at DESC,
        p.id DESC

      LIMIT 5
      `,
      [id]
    ),


    /* Recent purchases */

    pool.execute(
      `
      SELECT
        o.id,
        p.id AS product_id,
        o.amount,
        o.status,
        o.created_at,
        o.completed_at,
        p.title AS product_title,
        g.name AS game_name,
        seller.username AS seller_username,

        (
          SELECT pi.image_url
          FROM product_images pi
          WHERE pi.product_id = p.id
          ORDER BY
            pi.is_primary DESC,
            pi.sort_order ASC,
            pi.id ASC
          LIMIT 1
        ) AS image_url

      FROM orders o

      INNER JOIN products p
        ON p.id = o.product_id

      INNER JOIN games g
        ON g.id = p.game_id

      INNER JOIN users seller
        ON seller.id = o.seller_id

      WHERE o.buyer_id = ?

      ORDER BY
        o.created_at DESC,
        o.id DESC

      LIMIT 5
      `,
      [id]
    ),


    /* Latest reviews received */

    pool.execute(
      `
      SELECT
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        buyer.username AS buyer_username

      FROM reviews r

      INNER JOIN users buyer
        ON buyer.id = r.buyer_id

      WHERE
        r.seller_id = ?
        AND r.status = 'ACTIVE'

      ORDER BY
        r.created_at DESC,
        r.id DESC

      LIMIT 5
      `,
      [id]
    ),

  ]);


  const verification =
    verificationRows[0] || null;

  const sales =
    salesRows[0] || {};

  const reviewSummary =
    reviewSummaryRows[0] || {};

  const wallet =
    walletRows[0] || {};


  return {
    ...user,

    avatarUrl:
      row.avatar_url || null,

    dateOfBirth:
      row.date_of_birth || null,

    suspensionReason:
      row.suspension_reason || null,

    suspendedUntil:
      row.suspended_until || null,

    /*
      refresh_tokens ไม่มี field last_login โดยตรง
      จึงใช้ session ล่าสุดแทน
    */
    lastSessionAt:
      row.last_session_at || null,


    sellerInfo: {
      isSeller:
        user.roles.includes('SELLER'),

      verificationStatus:
        verification?.status || null,

      verifiedAt:
        verification?.status === 'APPROVED'
          ? verification.reviewed_at
          : null,

      completedSales:
        Number(
          sales.completed_sales || 0
        ),

      totalSalesAmount:
        Number(
          sales.total_sales_amount || 0
        ),

      reviewCount:
        Number(
          reviewSummary.review_count || 0
        ),

      averageRating:
        Number(
          reviewSummary.average_rating || 0
        ),
    },


    walletSummary: {
      balance:
        Number(user.walletBalance || 0),

      saleIncome:
        Number(
          wallet.sale_income || 0
        ),

      totalWithdrawal:
        Number(
          wallet.total_withdrawal || 0
        ),
    },


    recentProducts:
      productRows.map(item => ({
        id:
          Number(item.id),

        title:
          item.title,

        price:
          Number(item.price),

        status:
          item.status,

        gameName:
          item.game_name,

        imageUrl:
          item.image_url || null,

        createdAt:
          item.created_at,
      })),


    recentPurchases:
      purchaseRows.map(item => ({
        id:
          Number(item.id),

        productId:
          Number(item.product_id),

        amount:
          Number(item.amount),

        status:
          item.status,

        productTitle:
          item.product_title,

        gameName:
          item.game_name,

        sellerUsername:
          item.seller_username,

        imageUrl:
          item.image_url || null,

        createdAt:
          item.created_at,

        completedAt:
          item.completed_at,
      })),


    recentReviews:
      reviewRows.map(item => ({
        id:
          Number(item.id),

        rating:
          Number(item.rating),

        comment:
          item.comment || '',

        buyerUsername:
          item.buyer_username,

        createdAt:
          item.created_at,
      })),
  };
}

module.exports = { listUsers, getUser };
