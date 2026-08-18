"use strict";

const express = require("express");
const controller = require("../controllers/user.controller");
const { validate } = require("../middleware/validate.middleware");
const { authenticate } = require("../middleware/auth.middleware");
const { requireCsrf } = require("../middleware/csrf.middleware");
const schemas = require("../validators/user.validator");

const router = express.Router();

// All user profile routes require authentication and a valid CSRF token.
router.patch("/username", authenticate, requireCsrf, validate(schemas.updateUsernameSchema), controller.updateUsername);
router.patch("/email",    authenticate, requireCsrf, validate(schemas.updateEmailSchema),    controller.updateEmail);

module.exports = router;
