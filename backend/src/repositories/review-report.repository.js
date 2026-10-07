const { reviewReports } = require('./report-storage');
const { pool } = require('../config/database');

async function findReview(reviewId, executor = pool) {
  const [rows] = await executor.execute(
    'SELECT id, buyer_id, seller_id, rating, comment, status FROM reviews WHERE id=? LIMIT 1', [reviewId],
  );
  return rows[0] || null;
}

async function findExisting(reviewId, reporterId, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT id, status FROM ${reviewReports} reviewReports_rows WHERE review_id=? AND reporter_id=? LIMIT 1`, [reviewId, reporterId],
  );
  return rows[0] || null;
}

async function create(data, executor = pool) {
  const [result] = await executor.execute(
    `INSERT INTO reports (report_type,review_id, reporter_id, reason, description) VALUES ('REVIEW',?, ?, ?, ?)`, [data.reviewId, data.reporterId, data.reason, data.description || null],
  );
  const [rows] = await executor.execute(`SELECT * FROM ${reviewReports} reviewReports_rows WHERE id=? LIMIT 1`, [result.insertId]);
  return rows[0] || null;
}

async function listPending(executor = pool) {
  const [rows] = await executor.execute(
    `SELECT rr.*, r.rating, r.comment, r.seller_id, r.buyer_id,
            reporter.username reporter_username, seller.username seller_username,
            buyer.username buyer_username
     FROM ${reviewReports} rr
     INNER JOIN reviews r ON r.id=rr.review_id
     INNER JOIN users reporter ON reporter.id=rr.reporter_id
     INNER JOIN users seller ON seller.id=r.seller_id
     INNER JOIN users buyer ON buyer.id=r.buyer_id
     WHERE rr.status='PENDING' ORDER BY rr.created_at ASC`,
  );
  return rows;
}

async function listAll(executor = pool) {
  const [rows] = await executor.execute(
    `
    SELECT
      rr.*,
      r.rating,
      r.comment,
      r.seller_id,
      r.buyer_id,
      reporter.username AS reporter_username,
      seller.username AS seller_username,
      buyer.username AS buyer_username
    FROM ${reviewReports} rr
    INNER JOIN reviews r
      ON r.id = rr.review_id
    INNER JOIN users reporter
      ON reporter.id = rr.reporter_id
    INNER JOIN users seller
      ON seller.id = r.seller_id
    INNER JOIN users buyer
      ON buyer.id = r.buyer_id
    ORDER BY
      rr.created_at DESC,
      rr.id DESC
    `
  );

  return rows;
}

async function updateStatus(reportId, status, adminId, adminNote, executor = pool) {
  const [result] = await executor.execute(
    `UPDATE reports SET status=?, admin_note=?, resolved_at=CURRENT_TIMESTAMP, resolved_by=?
     WHERE report_type='REVIEW' AND COALESCE(source_report_id,id)=? AND status='PENDING'`, [status, adminNote || null, adminId, reportId],
  );
  if (!result.affectedRows) return null;
  const [rows] = await executor.execute(`SELECT * FROM ${reviewReports} reviewReports_rows WHERE id=? LIMIT 1`, [reportId]);
  return rows[0] || null;
}

async function getById(reportId, executor = pool) {
  const [rows] = await executor.execute(`SELECT id, review_id, reporter_id, status FROM ${reviewReports} reviewReports_rows WHERE id=? LIMIT 1`, [reportId]);
  return rows[0] || null;
}

async function hideReview(reviewId, executor = pool) {
  await executor.execute("UPDATE reviews SET status='HIDDEN' WHERE id=?", [reviewId]);
}

async function findChatContext(
  reportId,
  executor = pool
) {
  const [rows] =
    await executor.execute(
      `
      SELECT
        rr.id,
        rr.review_id,
        rr.reporter_id,

        r.buyer_id AS reviewer_id,

        reporter.username
          AS reporter_username,

        reporter.avatar_url
          AS reporter_avatar_url,

        reviewer.username
          AS reviewer_username,

        reviewer.avatar_url
          AS reviewer_avatar_url

      FROM ${reviewReports} rr

      INNER JOIN reviews r
        ON r.id = rr.review_id

      INNER JOIN users reporter
        ON reporter.id = rr.reporter_id

      INNER JOIN users reviewer
        ON reviewer.id = r.buyer_id

      WHERE rr.id = ?
      LIMIT 1
      `,
      [reportId]
    );

  return rows[0] || null;
}

module.exports = {
  findReview,
  findExisting,
  create,
  listPending,
  listAll,
  updateStatus,
  getById,
  hideReview,
  findChatContext
};