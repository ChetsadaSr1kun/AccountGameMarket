const multer = require('multer');
const AppError = require('../utils/app-error');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 10;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_IMAGES },
  fileFilter(req, file, callback) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return callback(new AppError('Images must be JPEG, PNG, or WebP.', 422, 'INVALID_PRODUCT_IMAGE_TYPE'));
    }
    return callback(null, true);
  },
}).array('images', MAX_IMAGES);

function uploadProductImages(req, res, next) {
  upload(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return next(new AppError('Each image must be 5 MiB or smaller.', 422, 'PRODUCT_IMAGE_TOO_LARGE'));
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_COUNT') return next(new AppError('A maximum of 10 images is allowed.', 422, 'PRODUCT_IMAGE_LIMIT'));
    if (error) return next(error);
    if (!req.files?.length) return next(new AppError('At least one image is required.', 422, 'PRODUCT_IMAGE_REQUIRED'));
    return next();
  });
}

module.exports = { uploadProductImages, MAX_IMAGE_BYTES, MAX_IMAGES };