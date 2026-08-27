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
  const [rows] = await pool.execute(`SELECT g.id,g.name,g.slug,g.description,g.image_url,g.status,g.created_at,g.updated_at,COUNT(p.id) AS product_count FROM games g LEFT JOIN products p ON p.game_id=g.id GROUP BY g.id ORDER BY g.name`);
  return rows.map((row) => ({ ...mapGame(row), productCount: Number(row.product_count), createdAt: row.created_at, updatedAt: row.updated_at }));
}

async function createAdmin(data) {
  const [result] = await pool.execute('INSERT INTO games (name,slug,description,image_url,status) VALUES (?,?,?,?,?)',[data.name,data.slug,data.description||null,data.imageUrl||null,data.status||'ACTIVE']);
  return findAdminById(result.insertId);
}

async function findAdminById(id) {
  const [rows] = await pool.execute(`SELECT g.id,g.name,g.slug,g.description,g.image_url,g.status,g.created_at,g.updated_at,COUNT(p.id) AS product_count FROM games g LEFT JOIN products p ON p.game_id=g.id WHERE g.id=? GROUP BY g.id LIMIT 1`, [id]);
  const row = rows[0];
  return row ? { ...mapGame(row), productCount: Number(row.product_count), createdAt: row.created_at, updatedAt: row.updated_at } : null;
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
  const [[users]] = await pool.execute("SELECT COUNT(*) total FROM users WHERE status <> 'DELETED'");
  const [[products]] = await pool.execute("SELECT COUNT(*) total FROM products WHERE status IN ('ACTIVE','SOLD')");
  const [[sales]] = await pool.execute("SELECT COALESCE(SUM(amount),0) total FROM orders WHERE status IN ('PAID','COMPLETED') AND created_at >= DATE_FORMAT(CURRENT_DATE,'%Y-%m-01')");
  const [[reports]] = await pool.execute("SELECT COUNT(*) total FROM transaction_reports WHERE status IN ('PENDING','REVIEWED')");
  const [recent] = await pool.execute(`SELECT o.id,o.amount,o.status,gb.name game_name,b.username buyer_username,s.username seller_username FROM orders o INNER JOIN users b ON b.id=o.buyer_id INNER JOIN users s ON s.id=o.seller_id INNER JOIN products p ON p.id=o.product_id INNER JOIN games gb ON gb.id=p.game_id ORDER BY o.created_at DESC LIMIT 5`);
  const [popular] = await pool.execute(`SELECT g.id,g.name,COUNT(o.id) order_count FROM games g LEFT JOIN products p ON p.game_id=g.id LEFT JOIN orders o ON o.product_id=p.id AND o.status IN ('PAID','COMPLETED') GROUP BY g.id ORDER BY order_count DESC,g.name LIMIT 6`);
  return { totals:{users:Number(users.total),products:Number(products.total),monthlySales:Number(sales.total),openReports:Number(reports.total)}, recentTransactions:recent, popularGames:popular };
}

module.exports = { listActive, findActiveById, listActiveAttributes, listAdmin, findAdminById, createAdmin, updateAdmin, adminDashboard };
