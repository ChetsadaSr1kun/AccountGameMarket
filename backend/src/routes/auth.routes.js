const express = require('express');
const controller = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { requireCsrf } = require('../middleware/csrf.middleware');
const { loginLimit, forgotPasswordLimit } = require('../middleware/rate-limit.middleware');
const schemas = require('../validators/auth.validator');

const router = express.Router();

router.get('/csrf', controller.csrf);
router.post('/register', validate(schemas.registerSchema), controller.register);
router.post('/login', loginLimit, validate(schemas.loginSchema), controller.login);
router.post('/refresh', controller.refresh);
router.post('/forgot-password', forgotPasswordLimit, validate(schemas.forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', forgotPasswordLimit, validate(schemas.resetPasswordSchema), controller.resetPassword);
router.get('/me', authenticate, controller.me);
router.post('/logout', authenticate, requireCsrf, controller.logout);
router.post('/logout-all', authenticate, requireCsrf, controller.logoutAll);
router.post('/change-password', authenticate, requireCsrf, validate(schemas.changePasswordSchema), controller.changePassword);

module.exports = router;
