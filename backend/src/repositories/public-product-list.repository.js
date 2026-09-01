const { pool } = require('../config/database');

function mapRow(row) {
  return {
    id: row.id,
    game: { id: row.game_id, name: row.game_name, slug: row.game_slug },
    seller: { id: row.seller_id, username: row.seller_username },
    title: row.title,
    description: row.description,
    price: Number(row.price),
    status: row.status,
    primaryImageUrl: row.primary_image_url || null,
    createdAt: row.created_at,
  };
}

async function listPublic(filters = {}, executor = pool) {
  const where = ["p.status IN ('ACTIVE','PUBLISHED')"];
  const params = [];
  if (filters.gameId) { where.push('p.game_id = ?'); params.push(filters.gameId); }
  if (filters.search) {
    where.push('(p.title LIKE ? OR p.description LIKE ? OR g.name LIKE ?)');
    const q = `%${filters.search}%`;
    params.push(q, q, q);
  }
  if (filters.minPrice !== undefined) { where.push('p.price >= ?'); params.push(filters.minPrice); }
  if (filters.maxPrice !== undefined) { where.push('p.price <= ?'); params.push(filters.maxPrice); }
  const sortMap = { newest: 'p.created_at DESC, p.id DESC', price_asc: 'p.price ASC, p.id DESC', price_desc: 'p.price DESC, p.id DESC', rating_desc: "COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.product_id=p.id AND r.status='ACTIVE'),0) DESC, p.created_at DESC, p.id DESC" };
  const orderBy = sortMap[filters.sort] || sortMap.newest;
  const limit = Math.min(Math.max(Number(filters.pageSize) || 12, 1), 50);
  const page = Math.max(Number(filters.page) || 1, 1);
  const offset = (page - 1) * limit;
  const baseWhere = where.join(' AND ');
  const [[countRow]] = await executor.query(
    `SELECT COUNT(*) AS total FROM products p INNER JOIN games g ON g.id=p.game_id INNER JOIN users u ON u.id=p.seller_id WHERE ${baseWhere}`,
    params,
  );
  const [rows] = await executor.query(
    `SELECT p.id,p.seller_id,p.game_id,p.title,p.description,p.price,p.status,p.created_at,
            g.name AS game_name,g.slug AS game_slug,u.username AS seller_username,
            pi.image_url AS primary_image_url
       FROM products p
       INNER JOIN games g ON g.id=p.game_id
       INNER JOIN users u ON u.id=p.seller_id
       LEFT JOIN product_images pi ON pi.product_id=p.id AND pi.is_primary=TRUE
      WHERE ${baseWhere}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return { items: rows.map(mapRow), total: Number(countRow.total), page, pageSize: limit, totalPages: Math.ceil(Number(countRow.total) / limit) };
}

module.exports = { listPublic };
