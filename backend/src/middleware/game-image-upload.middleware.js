const multer = require('multer');
const AppError = require('../utils/app-error');

const MAX_GAME_IMAGE_BYTES =
  5 * 1024 * 1024;

const ALLOWED_MIME_TYPES =
  new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_GAME_IMAGE_BYTES,
    files: 1,
  },

  fileFilter(req, file, callback) {
    if (
      !ALLOWED_MIME_TYPES.has(
        file.mimetype
      )
    ) {
      return callback(
        new AppError(
          'Game image must be JPEG, PNG, or WebP.',
          422,
          'INVALID_GAME_IMAGE_TYPE'
        )
      );
    }

    return callback(null, true);
  },
}).single('image');

function uploadGameImage(
  req,
  res,
  next
) {
  upload(
    req,
    res,
    (error) => {
      if (
        error instanceof
          multer.MulterError
      ) {
        if (
          error.code ===
          'LIMIT_FILE_SIZE'
        ) {
          return next(
            new AppError(
              'Game image must be 5 MiB or smaller.',
              422,
              'GAME_IMAGE_TOO_LARGE'
            )
          );
        }

        return next(
          new AppError(
            'Game image upload is invalid.',
            422,
            'INVALID_GAME_IMAGE_UPLOAD'
          )
        );
      }

      if (error) {
        return next(error);
      }

      if (!req.file) {
        return next(
          new AppError(
            'Game image is required.',
            422,
            'GAME_IMAGE_REQUIRED'
          )
        );
      }

      return next();
    }
  );
}

module.exports = {
  uploadGameImage,
  MAX_GAME_IMAGE_BYTES,
};