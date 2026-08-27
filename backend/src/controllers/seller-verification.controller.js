const sellerVerificationService = require('../services/seller-verification.service');
const { success } = require('../utils/response');
const asyncHandler = require('../utils/async-handler');

const getMyStatus = asyncHandler(async (req, res) => {
  const verification = await sellerVerificationService.getStatus(req.user.id);
  return success(res, 200, { verification });
});

function uploadMyDocument(type) {
  return asyncHandler(async (req, res) => {
    const result = await sellerVerificationService.uploadDocument(req.user.id, type, req.file);
    return success(res, 201, result);
  });
}

const uploadIdFront = uploadMyDocument('ID_FRONT');
const uploadIdBack = uploadMyDocument('ID_BACK');
const uploadSelfie = uploadMyDocument('SELFIE');

const submitMyRequest = asyncHandler(async (req, res) => {
  const verification = await sellerVerificationService.submit(req.user.id);
  return success(res, 200, { verification });
});

const approveRequest = asyncHandler(async (req, res) => {
  const user = await sellerVerificationService.approve(Number(req.params.userId), req.user.id);
  return success(res, 200, { user });
});

const listPendingRequests = asyncHandler(async (req, res) => {
  const requests = await sellerVerificationService.listPending();
  return success(res, 200, { requests });
});

const getAdminRequest = asyncHandler(async (req, res) => {
  const request = await sellerVerificationService.getRequestForAdmin(Number(req.params.userId));
  return success(res, 200, { request });
});

const rejectRequest = asyncHandler(async (req, res) => {
  const verification = await sellerVerificationService.reject(Number(req.params.userId), req.user.id, req.body.reason);
  return success(res, 200, { verification });
});

const getAdminDocument = asyncHandler(async (req, res) => {
  const result = await sellerVerificationService.getDocumentForAdmin(Number(req.params.userId), req.params.type);
  res.type(result.document.mime_type);
  return res.sendFile(result.absolutePath);
});

module.exports = {
  getMyStatus,
  uploadIdFront,
  uploadIdBack,
  uploadSelfie,
  submitMyRequest,
  approveRequest,
  listPendingRequests,
  getAdminRequest,
  rejectRequest,
  getAdminDocument,
};
