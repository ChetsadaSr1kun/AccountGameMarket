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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const productSelect = `
  SELECT p.id, p.seller_id, p.game_id, p.title, p.description, p.price, p.status,
         p.created_at, p.updated_at, g.name AS game_name, g.slug AS game_slug
  FROM products p
  INNER JOIN games g ON g.id = p.game_id
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

async function listAttributeValues(productId, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT game_attribute_id, game_attribute_option_id, value_text, value_number, value_boolean
     FROM product_attribute_values WHERE product_id = ?`,
    [productId],
  );
  return rows;
}

async function findGame(gameId, executor = pool) {
  const [rows] = await executor.execute(
    "SELECT id, name, slug, status FROM games WHERE id = ? LIMIT 1",
    [gameId],
  );
  return rows[0] || null;
}

async function findAttributesByIds(attributeIds, gameId, executor = pool) {
  if (!attributeIds.length) return [];
  const placeholders = attributeIds.map(() => '?').join(', ');
  const [rows] = await executor.execute(
    `SELECT id, game_id, name, slug, type, is_required, is_filterable, status
     FROM game_attributes
     WHERE game_id = ? AND id IN (${placeholders})`,
    [gameId, ...attributeIds],
  );
  return rows;
}

async function findOptionsByIds(optionIds, attributeIds, executor = pool) {
  if (!optionIds.length) return [];
  const placeholders = optionIds.map(() => '?').join(', ');
  const [rows] = await executor.execute(
    `SELECT id, game_attribute_id, label, value, status
     FROM game_attribute_options
     WHERE id IN (${placeholders})`,
    optionIds,
  );
  return rows.filter((row) => attributeIds.includes(row.game_attribute_id));
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

async function replaceAttributeValues(productId, values, executor = pool) {
  await executor.execute('DELETE FROM product_attribute_values WHERE product_id = ?', [productId]);
  for (const value of values) {
    await executor.execute(
      `INSERT INTO product_attribute_values
       (product_id, game_attribute_id, game_attribute_option_id, value_text, value_number, value_boolean)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [productId, value.attributeId, value.optionId || null, value.text ?? null, value.number ?? null, value.boolean ?? null],
    );
  }
}

async function deleteByIdForSeller(productId, sellerId, executor = pool) {
  const [result] = await executor.execute(
    'DELETE FROM products WHERE id = ? AND seller_id = ?',
    [productId, sellerId],
  );
  return result.affectedRows > 0;
}

module.exports = {
  listBySeller, findByIdForSeller, listAttributeValues, findGame, findAttributesByIds, findOptionsByIds,
  create, update, replaceAttributeValues, deleteByIdForSeller,
};
