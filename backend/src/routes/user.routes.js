"use strict";

const express = require("express");
const controller = require("../controllers/user.controller");
const { validate } = require("../middleware/validate.middleware");
const { authenticate } = require("../middleware/auth.middleware");
const { requireCsrf } = require("../middleware/csrf.middleware");
const { uploadAvatar } = require("../middleware/avatar-upload.middleware");
const { emailVerificationSendLimit, emailVerificationVerifyLimit, phoneVerificationSendLimit, phoneVerificationVerifyLimit } = require("../middleware/rate-limit.middleware");
const schemas = require("../validators/user.validator");

const router = express.Router();

// All user profile routes require authentication and a valid CSRF token.
router.patch("/username", authenticate, requireCsrf, validate(schemas.updateUsernameSchema), controller.updateUsername);
router.patch("/email",    authenticate, requireCsrf, validate(schemas.updateEmailSchema),    controller.updateEmail);
router.post("/avatar", authenticate, requireCsrf, uploadAvatar, controller.updateAvatar);
router.post("/verification/email/send", authenticate, requireCsrf, emailVerificationSendLimit, controller.sendEmailVerificationOtp);
router.post("/verification/email/verify", authenticate, requireCsrf, emailVerificationVerifyLimit, validate(schemas.verifyEmailOtpSchema), controller.verifyEmailVerificationOtp);
router.post("/verification/phone/send", authenticate, requireCsrf, phoneVerificationSendLimit, controller.sendPhoneVerificationOtp);
router.post("/verification/phone/verify", authenticate, requireCsrf, phoneVerificationVerifyLimit, validate(schemas.verifyPhoneOtpSchema), controller.verifyPhoneVerificationOtp);

module.exports = router;
