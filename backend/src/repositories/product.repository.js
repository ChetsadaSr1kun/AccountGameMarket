const { pool } = require('../config/database');

function mapProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    sellerId: row.seller_id,
    gameId: row.game_id,
    game: row.game_name ? { id: row.game_id, name: row.game_name, slug: row.game_slug } : null,
    title: row.title,
    description: row.description,
    price: Number(row.price),
    status: row.status,

    primaryImageUrl:
      row.primary_image_url ||
      null,

      valorantVerification:
        row.valorant_verified
          ? {
              verified: true,
            }
          : null,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const productSelect = `
  SELECT
    p.id,
    p.seller_id,
    p.game_id,
    p.title,
    p.description,
    p.price,
    p.status,
    p.created_at,
    p.updated_at,

    g.name AS game_name,
    g.slug AS game_slug,

    (
      SELECT pi.image_url
      FROM product_images pi
      WHERE pi.product_id = p.id
      ORDER BY
        pi.is_primary DESC,
        pi.sort_order ASC,
        pi.id ASC
      LIMIT 1
    ) AS primary_image_url,

    (
      p.valorant_riot_puuid IS NOT NULL
    ) AS valorant_verified

  FROM products p

  INNER JOIN games g
    ON g.id = p.game_id
`;

async function listBySeller(sellerId) {
  const [rows] = await pool.execute(
    `${productSelect} WHERE p.seller_id = ? ORDER BY p.created_at DESC, p.id DESC`,
    [sellerId],
  );
  return rows.map(mapProduct);
}

async function findByIdForSeller(sellerId, productId, executor = pool) {
  const [rows] = await executor.execute(
    `${productSelect} WHERE p.seller_id = ? AND p.id = ? LIMIT 1`,
    [sellerId, productId],
  );
  return mapProduct(rows[0]);
}

async function findGame(gameId, executor = pool) {
  const [rows] = await executor.execute(
    "SELECT id, name, slug, status FROM games WHERE id = ? LIMIT 1",
    [gameId],
  );
  return rows[0] || null;
}

async function create(data, executor = pool) {
  const [result] = await executor.execute(
    `INSERT INTO products (seller_id, game_id, title, description, price, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.sellerId, data.gameId, data.title, data.description, data.price, data.status || 'DRAFT'],
  );
  return result.insertId;
}

async function update(productId, sellerId, data, executor = pool) {
  const fields = [];
  const values = [];
  for (const [column, value] of Object.entries(data)) {
    fields.push(`${column} = ?`);
    values.push(value);
  }
  if (!fields.length) return false;
  const [result] = await executor.execute(
    `UPDATE products SET ${fields.join(', ')} WHERE id = ? AND seller_id = ?`,
    [...values, productId, sellerId],
  );
  return result.affectedRows > 0;
}

async function deleteByIdForSeller(productId, sellerId, executor = pool) {
  const [result] = await executor.execute(
    'DELETE FROM products WHERE id = ? AND seller_id = ?',
    [productId, sellerId],
  );
  return result.affectedRows > 0;
}

module.exports = {
  listBySeller,
  findByIdForSeller,
  findGame,
  create,
  update,
  deleteByIdForSeller,
};