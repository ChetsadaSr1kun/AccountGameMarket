const { pool } = require('../config/database');

async function findByUserId(userId, executor = pool) {
  const [rows] = await executor.execute(
    'SELECT id, user_id, status, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at FROM seller_verification_requests WHERE user_id = ? LIMIT 1',
    [userId],
  );
  return rows[0] || null;
}

async function createDraft(executor, userId) {
  await executor.execute(`
    INSERT INTO seller_verification_requests (user_id, status, rejection_reason, reviewed_by, reviewed_at)
    VALUES (?, 'DRAFT', NULL, NULL, NULL)
    ON DUPLICATE KEY UPDATE status = IF(status = 'APPROVED', status, 'DRAFT'), rejection_reason = NULL,
      reviewed_by = NULL, reviewed_at = NULL, updated_at = UTC_TIMESTAMP(3)`, [userId]);
  return findByUserId(userId, executor);
}

const documentPrefixes = Object.freeze({ ID_FRONT: 'id_front', ID_BACK: 'id_back', SELFIE: 'selfie' });

function documentPrefix(type) {
  if (!Object.hasOwn(documentPrefixes, type)) throw new TypeError('Unsupported seller document type.');
  return documentPrefixes[type];
}

function documentSelect(type) {
  const prefix = documentPrefix(type);
  return `SELECT ${prefix}_id id,id request_id,'${type}' document_type,
    ${prefix}_storage_path storage_path,${prefix}_mime_type mime_type,
    ${prefix}_file_size file_size,${prefix}_sha256 sha256,${prefix}_created_at created_at
    FROM seller_verification_requests WHERE id=? AND ${prefix}_id IS NOT NULL`;
}

async function findDocument(requestId, documentType, executor = pool) {
  const [rows] = await executor.execute(documentSelect(documentType), [requestId]);
  return rows[0] || null;
}

async function listDocuments(requestId, executor = pool) {
  const [rows] = await executor.execute(
    Object.keys(documentPrefixes).map(documentSelect).join(' UNION ALL ') + ' ORDER BY id',
    [requestId, requestId, requestId],
  );
  return rows;
}

async function upsertDocument(executor, requestId, documentType, document) {
  const prefix = documentPrefix(documentType);
  // The service supplies its transaction connection; serialize uploads to this request.
  await executor.execute('SELECT id FROM seller_verification_requests WHERE id=? FOR UPDATE', [requestId]);
  await executor.execute(`UPDATE seller_verification_requests SET
    ${prefix}_id=COALESCE(${prefix}_id,document_id_floor + id * 3
      + (id_front_id IS NOT NULL) + (id_back_id IS NOT NULL) + (selfie_id IS NOT NULL)),
    ${prefix}_storage_path=?,${prefix}_mime_type=?,${prefix}_file_size=?,${prefix}_sha256=?,
    ${prefix}_created_at=CURRENT_TIMESTAMP(3),updated_at=updated_at WHERE id=?`,
    [document.storagePath, document.mimeType, document.fileSize, document.sha256, requestId]);
  return findDocument(requestId, documentType, executor);
}

async function submit(executor, userId) {
  await executor.execute(`UPDATE seller_verification_requests SET status='PENDING',rejection_reason=NULL,
    reviewed_by=NULL,reviewed_at=NULL,updated_at=UTC_TIMESTAMP(3) WHERE user_id=? AND status IN ('DRAFT','REJECTED')`, [userId]);
  return findByUserId(userId, executor);
}

async function approve(executor, userId, reviewedBy) {
  await executor.execute(`UPDATE seller_verification_requests SET status='APPROVED',reviewed_by=?,
    reviewed_at=UTC_TIMESTAMP(3),rejection_reason=NULL WHERE user_id=? AND status='PENDING'`, [reviewedBy, userId]);
}
async function listPending(executor = pool) {
  const [rows] = await executor.execute(`SELECT r.id,r.user_id,r.status,r.rejection_reason,r.created_at,r.updated_at,
    u.username,u.email,u.first_name,u.last_name,u.phone FROM seller_verification_requests r
    INNER JOIN users u ON u.id=r.user_id WHERE r.status='PENDING' ORDER BY r.created_at ASC,r.id ASC`);
  return rows;
}

async function listAdminHistory(executor = pool) {
  const [rows] = await executor.execute(`SELECT r.id,r.user_id,r.status,r.rejection_reason,r.reviewed_by,r.reviewed_at,r.created_at,r.updated_at,
    u.username,u.email,u.first_name,u.last_name,
    reviewer.username AS reviewer_username
    FROM seller_verification_requests r INNER JOIN users u ON u.id=r.user_id
    LEFT JOIN users reviewer ON reviewer.id=r.reviewed_by
    WHERE r.status IN ('APPROVED','REJECTED') ORDER BY r.reviewed_at DESC,r.id DESC LIMIT 200`);
  return rows;
}

async function findRequestWithUser(userId, executor = pool) {
  const [rows] = await executor.execute(`SELECT r.id,r.user_id,r.status,r.rejection_reason,r.reviewed_by,r.reviewed_at,r.created_at,r.updated_at,
    u.username,u.email,u.first_name,u.last_name,u.phone,u.date_of_birth FROM seller_verification_requests r
    INNER JOIN users u ON u.id=r.user_id WHERE r.user_id=? LIMIT 1`, [userId]);
  return rows[0] || null;
}

async function reject(executor, userId, reviewedBy, reason) {
  await executor.execute(`UPDATE seller_verification_requests SET status='REJECTED',reviewed_by=?,reviewed_at=UTC_TIMESTAMP(3),
    rejection_reason=? WHERE user_id=? AND status='PENDING'`, [reviewedBy, reason, userId]);
  return findByUserId(userId, executor);
}

module.exports = { findByUserId, createDraft, findDocument, listDocuments, upsertDocument, submit, approve,
  listPending, listAdminHistory, findRequestWithUser, reject };
