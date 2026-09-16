const multer = require('multer');
const AppError = require('../utils/app-error');

const MAX_SLIP_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jfif']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SLIP_BYTES, files: 1 },
  fileFilter(req, file, callback) {
    if (!ALLOWED_MIME_TYPES.has(String(file.mimetype || '').toLowerCase())) {
      return callback(new AppError('สลิปต้องเป็นไฟล์ JPEG, PNG หรือ WebP เท่านั้น', 422, 'INVALID_SLIP_FILE_TYPE'));
    }
    return callback(null, true);
  },
}).single('slip');

function uploadSlip(req, res, next) {
  upload(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('ไฟล์สลิปต้องมีขนาดไม่เกิน 5 MiB', 422, 'SLIP_FILE_TOO_LARGE'));
    }
    if (error) return next(error);
    if (!req.file) return next(new AppError('กรุณาอัปโหลดสลิปการโอนเงิน', 422, 'SLIP_FILE_REQUIRED'));
    return next();
  });
}

module.exports = { uploadSlip, MAX_SLIP_BYTES, ALLOWED_MIME_TYPES };
