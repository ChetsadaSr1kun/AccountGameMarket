const { pool } = require('../config/database');

function mapProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    game: { id: row.game_id, name: row.game_name, slug: row.game_slug },
    seller: { id: row.seller_id, username: row.seller_username },
    title: row.title,
    description: row.description,
    price: Number(row.price),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findPublicById(productId, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT p.id, p.seller_id, p.game_id, p.title, p.description, p.price, p.status,
            p.created_at, p.updated_at, g.name AS game_name, g.slug AS game_slug,
            u.username AS seller_username
     FROM products p
     INNER JOIN games g ON g.id = p.game_id
     INNER JOIN users u ON u.id = p.seller_id
     WHERE p.id = ? AND p.status IN ('ACTIVE', 'PUBLISHED') AND g.status = 'ACTIVE' LIMIT 1`,
    [productId],
  );
  return mapProduct(rows[0]);
}

module.exports = { findPublicById };