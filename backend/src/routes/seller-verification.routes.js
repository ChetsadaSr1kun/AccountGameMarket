const express = require('express');
const controller = require('../controllers/seller-verification.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { requireCsrf } = require('../middleware/csrf.middleware');
const { uploadSellerDocument } = require('../middleware/seller-document-upload.middleware');

const router = express.Router();

router.get('/me', authenticate, controller.getMyStatus);
router.get('/admin/pending', authenticate, authorize('ADMIN'), controller.listPendingRequests);
router.get('/admin/:userId', authenticate, authorize('ADMIN'), controller.getAdminRequest);
router.get('/admin/:userId/documents/:type', authenticate, authorize('ADMIN'), controller.getAdminDocument);
router.post('/documents/id-front', authenticate, requireCsrf, uploadSellerDocument, controller.uploadIdFront);
router.post('/documents/id-back', authenticate, requireCsrf, uploadSellerDocument, controller.uploadIdBack);
router.post('/documents/selfie', authenticate, requireCsrf, uploadSellerDocument, controller.uploadSelfie);
router.post('/submit', authenticate, requireCsrf, controller.submitMyRequest);
router.post('/:userId/approve', authenticate, authorize('ADMIN'), requireCsrf, controller.approveRequest);
router.post('/:userId/reject', authenticate, authorize('ADMIN'), requireCsrf, controller.rejectRequest);

module.exports = router;
