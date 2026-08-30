const fs = require('fs/promises');
const sellerVerificationRepository = require('../repositories/seller-verification.repository');
const userRepository = require('../repositories/user.repository');
const roleRepository = require('../repositories/role.repository');
const refreshTokenRepository = require('../repositories/refresh-token.repository');
const { saveSellerDocument } = require('../utils/seller-document');
const { withTransaction } = require('../utils/transaction');
const AppError = require('../utils/app-error');
const { publicUser } = require('./user.service');
const notificationService = require('./notification.service');

const REQUIRED_DOCUMENT_TYPES = ['ID_FRONT', 'ID_BACK', 'SELFIE'];

async function getStatus(userId) {
  const request = await sellerVerificationRepository.findByUserId(userId);
  if (!request) return { status: 'NOT_STARTED', documents: [] };
  const documents = await sellerVerificationRepository.listDocuments(request.id);
  return { ...request, documents };
}

async function uploadDocument(userId, type, file) {
  if (!REQUIRED_DOCUMENT_TYPES.includes(type)) throw new AppError('Unsupported seller document type.', 422, 'INVALID_SELLER_DOCUMENT_TYPE');
  const user = await userRepository.findAuthUserById(userId);
  if (!user) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  if (!(user.emailVerifiedAt && user.phoneVerifiedAt)) throw new AppError('Email and phone must both be verified before uploading seller documents.', 403, 'ACCOUNT_NOT_VERIFIED');
  if (user.roles.includes('SELLER')) throw new AppError('User is already a seller.', 409, 'ALREADY_SELLER');
  const current = await sellerVerificationRepository.findByUserId(userId);
  if (current && current.status === 'PENDING') throw new AppError('Seller verification is already pending review.', 409, 'SELLER_REQUEST_PENDING');
  const document = await saveSellerDocument({ userId, type, file });
  try {
    return await withTransaction(async (connection) => {
      const request = await sellerVerificationRepository.createDraft(connection, userId);
      const saved = await sellerVerificationRepository.upsertDocument(connection, request.id, type, document);
      return { request: { ...request, status: 'DRAFT' }, document: saved };
    });
  } catch (error) {
    await fs.unlink(`${process.cwd()}/${document.storagePath}`).catch(() => {});
    throw error;
  }
}

async function submit(userId) {
  const user = await userRepository.findAuthUserById(userId);
  if (!user) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  if (!(user.emailVerifiedAt && user.phoneVerifiedAt)) throw new AppError('Email and phone must both be verified before applying to become a seller.', 403, 'ACCOUNT_NOT_VERIFIED');
  if (user.roles.includes('SELLER')) throw new AppError('User is already a seller.', 409, 'ALREADY_SELLER');
  const request = await sellerVerificationRepository.findByUserId(userId);
  if (!request || !['DRAFT', 'REJECTED'].includes(request.status)) throw new AppError('Seller documents must be prepared before submitting a request.', 409, 'SELLER_REQUEST_NOT_READY');
  const documents = await sellerVerificationRepository.listDocuments(request.id);
  const uploadedTypes = new Set(documents.map((document) => document.document_type));
  const missing = REQUIRED_DOCUMENT_TYPES.filter((type) => !uploadedTypes.has(type));
  if (missing.length) throw new AppError(`Missing required seller documents: ${missing.join(', ')}.`, 422, 'SELLER_DOCUMENTS_INCOMPLETE');
  return withTransaction((connection) => sellerVerificationRepository.submit(connection, userId));
}

async function approve(userId, adminId) {
  return withTransaction(async (connection) => {
    const request = await sellerVerificationRepository.findByUserId(userId, connection);
    if (!request || request.status !== 'PENDING') throw new AppError('No pending seller verification request was found.', 409, 'SELLER_REQUEST_NOT_PENDING');
    const [sellerRoleId] = await roleRepository.findIdsByCodes(connection, ['SELLER']);
    if (!sellerRoleId) throw new AppError('SELLER role is missing from the database.', 500, 'ROLE_SETUP_ERROR');
    await userRepository.assignRoles(connection, userId, [sellerRoleId]);
    await userRepository.updateAccountMode(connection, userId, 'UNIFIED');
    await sellerVerificationRepository.approve(connection, userId, adminId);
    await notificationService.create({ userId, type: 'SELLER_VERIFICATION_APPROVED', title: '\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34 Seller \u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08', message: 'คำขอ Seller ของคุณได้รับการอนุมัติแล้ว', referenceType: 'SELLER_VERIFICATION', referenceId: request.id }, connection);
    await refreshTokenRepository.revokeAllForUser(connection, userId);
    await userRepository.incrementTokenVersion(connection, userId);
    return publicUser(await userRepository.findAuthUserById(userId, connection));
  });
}

async function listPending() {
  const requests = await sellerVerificationRepository.listPending();
  return Promise.all(requests.map(async (request) => ({
    ...request,
    documents: await sellerVerificationRepository.listDocuments(request.id),
  })));
}

async function listAdminHistory() {
  return sellerVerificationRepository.listAdminHistory();
}

async function getRequestForAdmin(userId) {
  const request = await sellerVerificationRepository.findRequestWithUser(userId);
  if (!request) throw new AppError('Seller verification request was not found.', 404, 'SELLER_REQUEST_NOT_FOUND');
  return { ...request, documents: await sellerVerificationRepository.listDocuments(request.id) };
}

async function reject(userId, adminId, reason) {
  const cleanReason = String(reason || '').trim();
  if (cleanReason.length < 3 || cleanReason.length > 500) throw new AppError('Rejection reason must be between 3 and 500 characters.', 422, 'INVALID_REJECTION_REASON');
  return withTransaction(async (connection) => {
    const request = await sellerVerificationRepository.findByUserId(userId, connection);
    if (!request || request.status !== 'PENDING') throw new AppError('No pending seller verification request was found.', 409, 'SELLER_REQUEST_NOT_PENDING');
    const rejected = await sellerVerificationRepository.reject(connection, userId, adminId, cleanReason);
    await notificationService.create({ userId, type: 'SELLER_VERIFICATION_REJECTED', title: '\u0e04\u0e33\u0e02\u0e2d Seller \u0e16\u0e39\u0e01\u0e1b\u0e0f\u0e34\u0e40\u0e2a\u0e18', message: 'คำขอ Seller ถูกปฏิเสธ: ' + cleanReason, referenceType: 'SELLER_VERIFICATION', referenceId: rejected.id }, connection);
    return rejected;
  });
}

async function getDocumentForAdmin(userId, type) {
  if (!REQUIRED_DOCUMENT_TYPES.includes(type)) throw new AppError('Unsupported seller document type.', 422, 'INVALID_SELLER_DOCUMENT_TYPE');
  const request = await sellerVerificationRepository.findRequestWithUser(userId);
  if (!request) throw new AppError('Seller verification request was not found.', 404, 'SELLER_REQUEST_NOT_FOUND');
  const document = await sellerVerificationRepository.findDocument(request.id, type);
  if (!document) throw new AppError('Seller document was not found.', 404, 'SELLER_DOCUMENT_NOT_FOUND');
  const path = require('path');
  const absolutePath = path.resolve(process.cwd(), document.storage_path);
  const root = path.resolve(process.cwd(), 'uploads', 'seller-verification');
  if (!absolutePath.startsWith(`${root}${path.sep}`)) throw new AppError('Invalid seller document path.', 500, 'SELLER_DOCUMENT_PATH_ERROR');
  return { request, document, absolutePath };
}

module.exports = { getStatus, uploadDocument, submit, approve, listPending, listAdminHistory, getRequestForAdmin, reject, getDocumentForAdmin };
