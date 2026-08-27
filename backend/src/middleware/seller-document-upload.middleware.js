const multer = require('multer');
const AppError = require('../utils/app-error');

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 },
  fileFilter(req, file, callback) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) return callback(new AppError('Document must be a JPEG, PNG, or WebP image.', 422, 'INVALID_SELLER_DOCUMENT_TYPE'));
    return callback(null, true);
  },
}).single('document');

function uploadSellerDocument(req, res, next) {
  upload(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return next(new AppError('Document must be 5 MiB or smaller.', 422, 'SELLER_DOCUMENT_TOO_LARGE'));
    if (error) return next(error);
    if (!req.file) return next(new AppError('Document image is required.', 422, 'SELLER_DOCUMENT_REQUIRED'));
    return next();
  });
}

module.exports = { uploadSellerDocument, MAX_DOCUMENT_BYTES };
