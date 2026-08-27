const { pool } = require('../config/database');

async function findReview(reviewId, executor = pool) {
  const [rows] = await executor.execute(
    'SELECT id, buyer_id, seller_id, rating, comment, status FROM reviews WHERE id=? LIMIT 1', [reviewId],
  );
  return rows[0] || null;
}

async function findExisting(reviewId, reporterId, executor = pool) {
  const [rows] = await executor.execute(
    'SELECT id, status FROM review_reports WHERE review_id=? AND reporter_id=? LIMIT 1', [reviewId, reporterId],
  );
  return rows[0] || null;
}

async function create(data, executor = pool) {
  const [result] = await executor.execute(
    `INSERT INTO review_reports (review_id, reporter_id, reason, description)
     VALUES (?, ?, ?, ?)`, [data.reviewId, data.reporterId, data.reason, data.description || null],
  );
  const [rows] = await executor.execute('SELECT * FROM review_reports WHERE id=? LIMIT 1', [result.insertId]);
  return rows[0] || null;
}

async function listPending(executor = pool) {
  const [rows] = await executor.execute(
    `SELECT rr.*, r.rating, r.comment, r.seller_id, r.buyer_id,
            reporter.username reporter_username, seller.username seller_username,
            buyer.username buyer_username
     FROM review_reports rr
     INNER JOIN reviews r ON r.id=rr.review_id
     INNER JOIN users reporter ON reporter.id=rr.reporter_id
     INNER JOIN users seller ON seller.id=r.seller_id
     INNER JOIN users buyer ON buyer.id=r.buyer_id
     WHERE rr.status='PENDING' ORDER BY rr.created_at ASC`,
  );
  return rows;
}

async function updateStatus(reportId, status, adminId, adminNote, executor = pool) {
  const [result] = await executor.execute(
    `UPDATE review_reports SET status=?, admin_note=?, resolved_at=CURRENT_TIMESTAMP, resolved_by=?
     WHERE id=? AND status='PENDING'`, [status, adminNote || null, adminId, reportId],
  );
  if (!result.affectedRows) return null;
  const [rows] = await executor.execute('SELECT * FROM review_reports WHERE id=? LIMIT 1', [reportId]);
  return rows[0] || null;
}

module.exports = { findReview, findExisting, create, listPending, updateStatus };

async function getById(reportId, executor = pool) {
  const [rows] = await executor.execute('SELECT id, review_id, reporter_id, status FROM review_reports WHERE id=? LIMIT 1', [reportId]);
  return rows[0] || null;
}

async function hideReview(reviewId, executor = pool) {
  await executor.execute("UPDATE reviews SET status='HIDDEN' WHERE id=?", [reviewId]);
}

module.exports = { findReview, findExisting, create, listPending, updateStatus, getById, hideReview };
