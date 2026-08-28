const AppError = require('../utils/app-error');
const { pool } = require('../config/database');

function mapUser(row) {
  return {
    id: Number(row.id), username: row.username, email: row.email,
    firstName: row.first_name, lastName: row.last_name, phone: row.phone,
    accountMode: row.account_mode, status: row.status,
    emailVerified: Boolean(row.email_verified_at), phoneVerified: Boolean(row.phone_verified_at),
    createdAt: row.created_at, roles: row.role_codes ? row.role_codes.split(',') : [],
    walletBalance: Number(row.wallet_balance || 0),
    soldCount: Number(row.sold_count || 0), boughtCount: Number(row.bought_count || 0),
  };
}

async function listUsers(search = '', status = 'ALL', role = 'ALL') {
  const params = [];
  const where = [];
  if (search) { where.push('(u.username LIKE ? OR u.email LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (status !== 'ALL') { where.push('u.status = ?'); params.push(status); }
  const roleJoin = role !== 'ALL' ? 'INNER JOIN user_roles ur_filter ON ur_filter.user_id=u.id INNER JOIN roles r_filter ON r_filter.id=ur_filter.role_id AND r_filter.code=?' : '';
  if (role !== 'ALL') params.unshift(role);
  const sql = `SELECT u.id,u.username,u.email,u.first_name,u.last_name,u.phone,u.account_mode,u.status,u.email_verified_at,u.phone_verified_at,u.created_at,
    (SELECT GROUP_CONCAT(DISTINCT r.code ORDER BY r.id SEPARATOR ',') FROM user_roles ur INNER JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id) role_codes,
    COALESCE((SELECT w.balance FROM wallets w WHERE w.user_id=u.id),0) wallet_balance,
    (SELECT COUNT(*) FROM orders o WHERE o.seller_id=u.id AND o.status='COMPLETED') sold_count,
    (SELECT COUNT(*) FROM orders o WHERE o.buyer_id=u.id AND o.status='COMPLETED') bought_count
    FROM users u ${roleJoin} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200`;
  const [rows] = await pool.execute(sql, params);
  return rows.map(mapUser);
}

async function getUser(userId) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid user id.', 400, 'INVALID_USER_ID');
  const [rows] = await pool.execute(`SELECT u.id,u.username,u.email,u.first_name,u.last_name,u.phone,u.date_of_birth,u.account_mode,u.status,
    u.email_verified_at,u.phone_verified_at,u.created_at,
    (SELECT GROUP_CONCAT(DISTINCT r.code ORDER BY r.id SEPARATOR ',') FROM user_roles ur INNER JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id) role_codes,
    COALESCE((SELECT w.balance FROM wallets w WHERE w.user_id=u.id),0) wallet_balance,
    (SELECT COUNT(*) FROM orders o WHERE o.seller_id=u.id AND o.status='COMPLETED') sold_count,
    (SELECT COUNT(*) FROM orders o WHERE o.buyer_id=u.id AND o.status='COMPLETED') bought_count
    FROM users u WHERE u.id=? LIMIT 1`, [id]);
  if (!rows[0]) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  return mapUser(rows[0]);
}

module.exports = { listUsers, getUser };
