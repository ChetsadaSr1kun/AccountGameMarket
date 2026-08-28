const { pool } = require('../config/database');

async function create(data, executor = pool) {
  const [result] = await executor.execute(`INSERT INTO notifications
    (user_id,type,title,message,reference_type,reference_id)
    VALUES (?,?,?,?,?,?)`, [data.userId,data.type,data.title,data.message,data.referenceType||null,data.referenceId||null]);
  return findById(result.insertId, executor);
}

async function findById(id, executor = pool) {
  const [rows] = await executor.execute(`SELECT id,user_id,type,title,message,reference_type,reference_id,is_read,created_at,read_at
    FROM notifications WHERE id=? LIMIT 1`, [id]);
  return rows[0] || null;
}

async function listByUserId(userId, limit = 30, executor = pool) {
  const [rows] = await executor.execute(`SELECT id,user_id,type,title,message,reference_type,reference_id,is_read,created_at,read_at
    FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT ?`, [userId, limit]);
  return rows;
}

async function unreadCount(userId, executor = pool) {
  const [rows] = await executor.execute('SELECT COUNT(*) count FROM notifications WHERE user_id=? AND is_read=0', [userId]);
  return Number(rows[0]?.count || 0);
}

async function markRead(userId, id, executor = pool) {
  const [result] = await executor.execute(`UPDATE notifications SET is_read=1,read_at=COALESCE(read_at,UTC_TIMESTAMP(3))
    WHERE id=? AND user_id=? AND is_read=0`, [id,userId]);
  return result.affectedRows > 0 ? findById(id, executor) : findById(id, executor);
}

async function markAllRead(userId, executor = pool) {
  const [result] = await executor.execute(`UPDATE notifications SET is_read=1,read_at=COALESCE(read_at,UTC_TIMESTAMP(3))
    WHERE user_id=? AND is_read=0`, [userId]);
  return Number(result.affectedRows || 0);
}

module.exports = { create, findById, listByUserId, unreadCount, markRead, markAllRead };
