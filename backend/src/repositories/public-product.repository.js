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
     WHERE p.id = ? AND p.status IN ('ACTIVE', 'PUBLISHED') LIMIT 1`,
    [productId],
  );
  return mapProduct(rows[0]);
}

async function listPublicAttributes(productId, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT pav.game_attribute_id AS attributeId, ga.name AS name, ga.slug AS slug, ga.type AS type,
            pav.game_attribute_option_id AS optionId, gao.label AS optionLabel,
            pav.value_text AS valueText, pav.value_number AS valueNumber, pav.value_boolean AS valueBoolean
     FROM product_attribute_values pav
     INNER JOIN game_attributes ga ON ga.id = pav.game_attribute_id
     LEFT JOIN game_attribute_options gao ON gao.id = pav.game_attribute_option_id
     WHERE pav.product_id = ? ORDER BY ga.id ASC`,
    [productId],
  );
  return rows.map((row) => ({ ...row, valueBoolean: row.valueBoolean === null ? null : Boolean(row.valueBoolean) }));
}

module.exports = { findPublicById, listPublicAttributes };