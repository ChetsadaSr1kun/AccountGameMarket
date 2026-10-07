const { pool } = require('../config/database');
function mapOrder(row) {
  if (!row) return null;

  return {
    id:
      Number(row.id),

    productId:
      Number(row.product_id),

    buyerId:
      Number(row.buyer_id),

    sellerId:
      Number(row.seller_id),

    amount:
      Number(row.amount),

    vatRatePercent:
      Number(
        row.vat_rate_percent || 0
      ),

    vatAmount:
      Number(
        row.vat_amount || 0
      ),

    sellerNetAmount:
      Number(
        row.seller_net_amount ??
        row.amount
      ),

    status:
      row.status,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,

    completedAt:
      row.completed_at,
  };
}
async function findProductForPurchase(
  productId,
  executor = pool
) {
  const [rows] = await executor.execute(
    `
    SELECT
      p.id,
      p.seller_id,
      p.price,
      p.status

    FROM products p

    INNER JOIN games g
      ON g.id = p.game_id

    WHERE
      p.id = ?
      AND g.status = 'ACTIVE'

    FOR UPDATE
    `,
    [productId]
  );

  return rows[0] || null;
}
async function findPendingByBuyerAndProduct(buyerId,productId,executor=pool){const [rows]=await executor.execute("SELECT * FROM orders WHERE buyer_id=? AND product_id=? AND status='PENDING' LIMIT 1",[buyerId,productId]);return mapOrder(rows[0]);}
async function create(
  data,
  executor = pool
) {
  const [result] =
    await executor.execute(
      `
      INSERT INTO orders (
        product_id,
        buyer_id,
        seller_id,
        amount,
        vat_rate_percent,
        vat_amount,
        seller_net_amount,
        status
      )
      VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        'PENDING'
      )
      `,
      [
        data.productId,
        data.buyerId,
        data.sellerId,
        data.amount,
        data.vatRatePercent,
        data.vatAmount,
        data.sellerNetAmount,
      ]
    );

  return result.insertId;
}
async function findByIdForPayment(orderId,buyerId,executor=pool){const [rows]=await executor.execute('SELECT o.*,p.status AS product_status FROM orders o INNER JOIN products p ON p.id=o.product_id WHERE o.id=? AND o.buyer_id=? LIMIT 1 FOR UPDATE',[orderId,buyerId]);return rows[0]||null;}
async function markCompletedAndProductSold(orderId,productId,executor=pool){await executor.execute("UPDATE orders SET status='COMPLETED',completed_at=NOW(3) WHERE id=? AND status='PENDING'",[orderId]);await executor.execute("UPDATE products SET status='SOLD' WHERE id=? AND status='ACTIVE'",[productId]);}
async function listByUser(
  userId,
  executor = pool
) {
  const [rows] = await executor.execute(
    `
    SELECT
      o.*,
      p.title,
      p.status AS product_status,
      g.name AS game_name,
      bu.username AS buyer_username,
      su.username AS seller_username,
      r.id AS review_id,
      tr.id AS transaction_report_id,

      (
        SELECT pi.image_url
        FROM product_images pi
        WHERE pi.product_id = p.id
        ORDER BY
          pi.is_primary DESC,
          pi.sort_order ASC,
          pi.id ASC
        LIMIT 1
      ) AS primary_image_url

    FROM orders o

    INNER JOIN products p
      ON p.id = o.product_id

    INNER JOIN games g
      ON g.id = p.game_id

    INNER JOIN users bu
      ON bu.id = o.buyer_id

    INNER JOIN users su
      ON su.id = o.seller_id

    LEFT JOIN reviews r
      ON r.order_id = o.id
      AND r.buyer_id = o.buyer_id
      AND r.status = 'ACTIVE'

    LEFT JOIN transaction_reports tr
      ON tr.order_id = o.id
      AND tr.reporter_id = ?

    WHERE
      o.buyer_id = ?
      OR o.seller_id = ?

    ORDER BY o.created_at DESC
    `,
    [
      userId,
      userId,
      userId,
    ]
  );

  return rows.map(row => ({
    ...mapOrder(row),

    product: {
      title: row.title,
      status: row.product_status,
      gameName: row.game_name,
      primaryImageUrl:
        row.primary_image_url || null,
    },

    buyerUsername:
      row.buyer_username,

    sellerUsername:
      row.seller_username,

    reviewId:
      row.review_id
        ? Number(row.review_id)
        : null,

    hasReview:
      Boolean(row.review_id),

    transactionReportId:
      row.transaction_report_id
        ? Number(
            row.transaction_report_id
          )
        : null,

    hasTransactionReport:
      Boolean(
        row.transaction_report_id
      ),
  }));
}
async function findByIdForUser(
  orderId,
  userId,
  executor = pool
) {
  const [rows] = await executor.execute(
    `
    SELECT
      o.*,
      p.title,
      p.status AS product_status,
      g.name AS game_name,
      su.username AS seller_username,
      (
        SELECT pi.image_url
        FROM product_images pi
        WHERE pi.product_id = p.id
        ORDER BY
          pi.is_primary DESC,
          pi.sort_order ASC,
          pi.id ASC
        LIMIT 1
      ) AS primary_image_url

    FROM orders o

    INNER JOIN products p
      ON p.id = o.product_id

    INNER JOIN games g
      ON g.id = p.game_id

    INNER JOIN users su
      ON su.id = o.seller_id

    WHERE
      o.id = ?
      AND (
        o.buyer_id = ?
        OR o.seller_id = ?
      )

    LIMIT 1
    `,
    [orderId, userId, userId]
  );

  const order = mapOrder(rows[0]);

  if (order && rows[0]) {
    order.product = {
      title: rows[0].title,
      status: rows[0].product_status,
      gameName: rows[0].game_name,
      primaryImageUrl:
        rows[0].primary_image_url || null,
    };

    order.sellerUsername =
      rows[0].seller_username;
  }

  return order;
}
module.exports={findProductForPurchase,findPendingByBuyerAndProduct,create,findByIdForPayment,markCompletedAndProductSold,listByUser,findByIdForUser};
