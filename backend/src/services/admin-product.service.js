const AppError = require('../utils/app-error');
const { pool } = require('../config/database');

function mapProduct(row) {
  return {
    id: Number(row.id), sellerId: Number(row.seller_id), sellerUsername: row.seller_username,
    gameId: Number(row.game_id), gameName: row.game_name, title: row.title,
    description: row.description, price: Number(row.price), status: row.status,
    moderationReason: row.moderation_reason || null, moderatedAt: row.moderated_at || null,
    createdAt: row.created_at, updatedAt: row.updated_at,
    imageCount: Number(row.image_count || 0), reportCount: Number(row.report_count || 0),
  };
}

function validateStatus(status) {
  const value = String(status || 'ALL').toUpperCase();
  if (!['ALL','DRAFT','ACTIVE','PAUSED','SOLD','CANCELLED'].includes(value)) throw new AppError('Invalid product status.', 400, 'INVALID_PRODUCT_STATUS');
  return value;
}

async function listProducts(search = '', status = 'ALL', gameId = 'ALL') {
  const params = []; const where = [];
  const safeStatus = validateStatus(status);
  if (search) { where.push('(p.title LIKE ? OR u.username LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (safeStatus !== 'ALL') { where.push('p.status = ?'); params.push(safeStatus); }
  if (String(gameId) !== 'ALL' && gameId !== '') { const id = Number(gameId); if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid game id.', 400, 'INVALID_GAME_ID'); where.push('p.game_id = ?'); params.push(id); }
  const [rows] = await pool.execute(`
    SELECT p.id,p.seller_id,p.game_id,p.title,p.description,p.price,p.status,p.moderation_reason,p.moderated_at,p.created_at,p.updated_at,
      u.username AS seller_username,g.name AS game_name,
      (SELECT COUNT(*) FROM product_images pi WHERE pi.product_id=p.id) AS image_count,
      (SELECT COUNT(*) FROM transaction_reports tr INNER JOIN orders ro ON ro.id=tr.order_id WHERE ro.product_id=p.id) AS report_count
    FROM products p INNER JOIN users u ON u.id=p.seller_id INNER JOIN games g ON g.id=p.game_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY p.created_at DESC,p.id DESC LIMIT 200`, params);
  return rows.map(mapProduct);
}

async function getProduct(productId) {
  const id = Number(productId); if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid product id.', 400, 'INVALID_PRODUCT_ID');
  const [rows] = await pool.execute(`SELECT p.id,p.seller_id,p.game_id,p.title,p.description,p.price,p.status,p.moderation_reason,p.moderated_at,p.created_at,p.updated_at,u.username seller_username,g.name game_name,(SELECT COUNT(*) FROM product_images pi WHERE pi.product_id=p.id) image_count,(SELECT COUNT(*) FROM transaction_reports tr INNER JOIN orders ro ON ro.id=tr.order_id WHERE ro.product_id=p.id) report_count FROM products p INNER JOIN users u ON u.id=p.seller_id INNER JOIN games g ON g.id=p.game_id WHERE p.id=? LIMIT 1`, [id]);
  if (!rows[0]) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
  return mapProduct(rows[0]);
}

async function summary() {
  const [rows] = await pool.execute(`SELECT status,COUNT(*) total FROM products GROUP BY status`);
  const out = { total: 0, active: 0, paused: 0, sold: 0, draft: 0, cancelled: 0 };
  for (const row of rows) { const n = Number(row.total); out.total += n; if (row.status==='ACTIVE') out.active=n; else if(row.status==='PAUSED') out.paused=n; else if(row.status==='SOLD') out.sold=n; else if(row.status==='DRAFT') out.draft=n; else if(row.status==='CANCELLED') out.cancelled=n; }
  return out;
}

async function moderate(adminId, productId, status, reason = null) {
  const id = Number(productId); if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid product id.', 400, 'INVALID_PRODUCT_ID');
  const next = String(status || '').toUpperCase(); if (!['ACTIVE','PAUSED'].includes(next)) throw new AppError('Only ACTIVE and PAUSED are allowed for moderation.', 400, 'INVALID_MODERATION_STATUS');
  const text = String(reason || '').trim(); if (next === 'PAUSED' && !text) throw new AppError('A reason is required when hiding a product.', 400, 'MODERATION_REASON_REQUIRED');
  if (text.length > 500) throw new AppError('Reason must not exceed 500 characters.', 400, 'MODERATION_REASON_TOO_LONG');
  const [existing] = await pool.execute('SELECT id,status FROM products WHERE id=? LIMIT 1',[id]);
  if (!existing[0]) throw new AppError('Product not found.',404,'PRODUCT_NOT_FOUND');
  if (existing[0].status === 'SOLD' || existing[0].status === 'CANCELLED') throw new AppError('Sold or cancelled products cannot be moderated.',409,'PRODUCT_NOT_MODERATABLE');
  await pool.execute('UPDATE products SET status=?, moderation_reason=?, moderated_by=?, moderated_at=UTC_TIMESTAMP(3), updated_at=UTC_TIMESTAMP(3) WHERE id=?',[next,next==='PAUSED'?text:null,next==='PAUSED'?Number(adminId):null,id]);
  return getProduct(id);
}

module.exports = { listProducts, getProduct, summary, moderate };
