const { pool } = require('../config/database');

function mapImage(row) {
  return {
    id: row.id,
    productId: row.product_id,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    isPrimary: Boolean(row.is_primary),
    createdAt: row.created_at,
  };
}

async function listByProductId(productId, executor = pool) {
  const [rows] = await executor.execute(
    'SELECT id, product_id, image_url, sort_order, is_primary, created_at FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC',
    [productId],
  );
  return rows.map(mapImage);
}

async function countByProductId(productId, executor = pool) {
  const [rows] = await executor.execute('SELECT COUNT(*) AS total FROM product_images WHERE product_id = ?', [productId]);
  return Number(rows[0].total);
}

async function createMany(productId, images, executor = pool) {
  for (const image of images) {
    await executor.execute(
      'INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (?, ?, ?, ?)',
      [productId, image.imageUrl, image.sortOrder, image.isPrimary],
    );
  }
}

async function findByIdForProduct(productId, imageId, executor = pool) {
  const [rows] = await executor.execute(
    'SELECT id, product_id, image_url, sort_order, is_primary, created_at FROM product_images WHERE product_id = ? AND id = ? LIMIT 1',
    [productId, imageId],
  );
  return rows[0] ? mapImage(rows[0]) : null;
}

async function deleteById(productId, imageId, executor = pool) {
  const [result] = await executor.execute('DELETE FROM product_images WHERE product_id = ? AND id = ?', [productId, imageId]);
  return result.affectedRows > 0;
}

async function makeFirstPrimary(productId, executor = pool) {
  await executor.execute('UPDATE product_images SET is_primary = FALSE WHERE product_id = ?', [productId]);
  await executor.execute('UPDATE product_images SET is_primary = TRUE WHERE product_id = ? ORDER BY sort_order ASC, id ASC LIMIT 1', [productId]);
}

module.exports = { listByProductId, countByProductId, createMany, findByIdForProduct, deleteById, makeFirstPrimary };