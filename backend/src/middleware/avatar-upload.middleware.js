const multer = require('multer');
const AppError = require('../utils/app-error');

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
  fileFilter(req, file, callback) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return callback(new AppError('Avatar must be a JPEG, PNG, or WebP image.', 422, 'INVALID_AVATAR_FILE_TYPE'));
    }
    return callback(null, true);
  },
}).single('avatar');

function uploadAvatar(req, res, next) {
  upload(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('Avatar must be 2 MiB or smaller.', 422, 'AVATAR_FILE_TOO_LARGE'));
      }
      return next(new AppError('Avatar upload is invalid.', 422, 'INVALID_AVATAR_UPLOAD'));
    }
    if (error) return next(error);
    if (!req.file) return next(new AppError('Avatar image is required.', 422, 'AVATAR_REQUIRED'));
    return next();
  });
}

module.exports = { uploadAvatar, MAX_AVATAR_BYTES };
