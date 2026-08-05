const AppError = require('../utils/app-error');

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields = Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.') || 'request', issue.message]));
      return next(new AppError('Validation failed.', 422, 'VALIDATION_ERROR', fields));
    }
    req.validatedBody = result.data;
    return next();
  };
}

module.exports = { validate };
