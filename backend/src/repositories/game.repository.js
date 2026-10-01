const { pool } = require('../config/database');

function mapGame(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, slug: row.slug, description: row.description, imageUrl: row.image_url, status: row.status };
}

function mapAttribute(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    required: Boolean(row.is_required),
    filterable: Boolean(row.is_filterable),
    options: [],
  };
}

async function listActive() {
  const [rows] = await pool.execute("SELECT id, name, slug, description, image_url, status FROM games WHERE status = 'ACTIVE' ORDER BY name");
  return rows.map(mapGame);
}

async function findActiveById(id) {
  const [rows] = await pool.execute("SELECT id, name, slug, description, image_url, status FROM games WHERE id = ? AND status = 'ACTIVE' LIMIT 1", [id]);
  return mapGame(rows[0]);
}

async function listActiveAttributes(gameId) {
  const [rows] = await pool.execute(
    `SELECT ga.id, ga.name, ga.slug, ga.type, ga.is_required, ga.is_filterable,
            gao.id AS option_id, gao.label AS option_label, gao.value AS option_value,
            gao.sort_order AS option_sort_order
     FROM game_attributes ga
     LEFT JOIN game_attribute_options gao
       ON gao.game_attribute_id = ga.id AND gao.status = 'ACTIVE'
     WHERE ga.game_id = ? AND ga.status = 'ACTIVE'
     ORDER BY ga.sort_order, ga.id, gao.sort_order, gao.id`,
    [gameId],
  );

  const attributes = new Map();
  for (const row of rows) {
    if (!attributes.has(row.id)) attributes.set(row.id, mapAttribute(row));
    if (row.option_id !== null) {
      attributes.get(row.id).options.push({
        id: row.option_id,
        label: row.option_label,
        value: row.option_value,
        sortOrder: row.option_sort_order,
      });
    }
  }
  return [...attributes.values()];
}

async function listAdmin() {
  const [rows] = await pool.execute(`
    SELECT
      g.id,
      g.name,
      g.slug,
      g.description,
      g.image_url,
      g.status,
      g.created_at,
      g.updated_at,

      SUM(
        CASE
          WHEN g.status = 'ACTIVE'
            AND p.status IN ('ACTIVE', 'PUBLISHED')
          THEN 1
          ELSE 0
        END
      ) AS active_product_count

    FROM games g

    LEFT JOIN products p
      ON p.game_id = g.id

    GROUP BY g.id

    ORDER BY g.name
  `);

  return rows.map((row) => ({
    ...mapGame(row),

    activeProductCount:
      Number(
        row.active_product_count || 0
      ),

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  }));
}

async function createAdmin(data) {
  const [result] = await pool.execute('INSERT INTO games (name,slug,description,image_url,status) VALUES (?,?,?,?,?)',[data.name,data.slug,data.description||null,data.imageUrl||null,data.status||'ACTIVE']);
  return findAdminById(result.insertId);
}

async function findAdminById(id) {
  const [rows] =
    await pool.execute(
      `
        SELECT
          g.id,
          g.name,
          g.slug,
          g.description,
          g.image_url,
          g.status,
          g.created_at,
          g.updated_at,

          SUM(
            CASE
              WHEN g.status = 'ACTIVE'
                AND p.status IN ('ACTIVE', 'PUBLISHED')
              THEN 1
              ELSE 0
            END
          ) AS active_product_count

        FROM games g

        LEFT JOIN products p
          ON p.game_id = g.id

        WHERE g.id = ?

        GROUP BY g.id

        LIMIT 1
      `,
      [id]
    );

  const row = rows[0];

  return row
    ? {
        ...mapGame(row),

        activeProductCount:
          Number(
            row.active_product_count || 0
          ),

        createdAt:
          row.created_at,

        updatedAt:
          row.updated_at,
      }
    : null;
}

async function updateAdmin(id,data) {
  const fields=[]; const values=[];
  for (const [column,value] of [['name',data.name],['slug',data.slug],['description',data.description],['image_url',data.imageUrl],['status',data.status]]) {
    if (value !== undefined) { fields.push(`${column}=?`); values.push(value === '' ? null : value); }
  }
  if (!fields.length) return findAdminById(id);
  values.push(id);
  await pool.execute(`UPDATE games SET ${fields.join(',')} WHERE id=?`, values);
  return findAdminById(id);
}

async function adminDashboard() {
  const [[users]] = await pool.execute(
    "SELECT COUNT(*) total FROM users WHERE status <> 'DELETED'"
  );

  const [[products]] = await pool.execute(
    "SELECT COUNT(*) total FROM products WHERE status = 'ACTIVE'"
  );

  const [[topups]] = await pool.execute(
    `SELECT COALESCE(SUM(amount), 0) total
     FROM wallet_topup_requests
     WHERE status = 'APPROVED'`
  );

  const [[withdrawals]] = await pool.execute(
    `SELECT COALESCE(SUM(amount), 0) total
     FROM withdrawal_requests
     WHERE status = 'APPROVED'`
  );

  const [[orders]] = await pool.execute(
    `SELECT COUNT(*) total
     FROM orders
     WHERE status = 'COMPLETED'`
  );

  const [[sellerPending]] = await pool.execute(
    `SELECT COUNT(*) total
     FROM seller_verification_requests
     WHERE status = 'PENDING'`
  );

  const [[withdrawalPending]] = await pool.execute(
    `SELECT COUNT(*) total
     FROM withdrawal_requests
     WHERE status = 'PENDING'`
  );

  const [[transactionReports]] = await pool.execute(
    `SELECT COUNT(*) total
     FROM transaction_reports
     WHERE status IN ('PENDING', 'REVIEWED')`
  );

  const [[reviewReports]] = await pool.execute(
    `SELECT COUNT(*) total
     FROM review_reports
     WHERE status = 'PENDING'`
  );

  const [recent] = await pool.execute(
    `SELECT
       o.id,
       o.amount,
       o.status,
       o.completed_at,
       o.created_at,
       gb.name AS game_name,
       gb.image_url AS game_image_url,
       b.username AS buyer_username,
       s.username AS seller_username
     FROM orders o
     INNER JOIN users b ON b.id = o.buyer_id
     INNER JOIN users s ON s.id = o.seller_id
     INNER JOIN products p ON p.id = o.product_id
     INNER JOIN games gb ON gb.id = p.game_id
     WHERE o.status = 'COMPLETED'
     ORDER BY COALESCE(o.completed_at, o.updated_at) DESC
     LIMIT 5`
  );

  const [popular] = await pool.execute(
    `SELECT
       g.id,
       g.name,
       g.image_url,
       COUNT(o.id) AS order_count
     FROM games g
     LEFT JOIN products p
       ON p.game_id = g.id
     LEFT JOIN orders o
       ON o.product_id = p.id
       AND o.status = 'COMPLETED'
     GROUP BY g.id
     ORDER BY order_count DESC, g.name
     LIMIT 6`
  );

  const approvedTopups = Number(topups.total || 0);
  const approvedWithdrawals = Number(withdrawals.total || 0);

  return {
    totals: {
      users: Number(users.total),
      activeProducts: Number(products.total),
      netCashFlow: approvedTopups - approvedWithdrawals,
      completedOrders: Number(orders.total),
    },

    actionCounts: {
      sellerVerificationPending: Number(sellerPending.total),
      withdrawalPending: Number(withdrawalPending.total),
      transactionReportsOpen: Number(transactionReports.total),
      reviewReportsPending: Number(reviewReports.total),
    },

    recentTransactions: recent,
    popularGames: popular,
  };
}

module.exports = { listActive, findActiveById, listActiveAttributes, listAdmin, findAdminById, createAdmin, updateAdmin, adminDashboard };
