"use strict";

const userService = require("../services/user.service");
const emailVerificationService = require("../services/email-verification.service");
const { success } = require("../utils/response");
const asyncHandler = require("../utils/async-handler");

const updateUsername = asyncHandler(async (req, res) => {
  const user = await userService.updateUsername(req.user.id, req.validatedBody.newUsername);
  return success(res, 200, { user });
});

const updateEmail = asyncHandler(async (req, res) => {
  const user = await userService.updateEmail(req.user.id, req.validatedBody.newEmail);
  return success(res, 200, { user });
});

const updateAvatar = asyncHandler(async (req, res) => {
  const user = await userService.updateAvatar(req.user.id, req.file);
  return success(res, 200, { user });
});

const sendEmailVerificationOtp = asyncHandler(async (req, res) => {
  await emailVerificationService.sendEmailOtp(req.user.id);
  return res.status(204).end();
});

const verifyEmailVerificationOtp = asyncHandler(async (req, res) => {
  const user = await emailVerificationService.verifyEmailOtp(req.user.id, req.validatedBody.otp);
  return success(res, 200, { user });
});

module.exports = { updateUsername, updateEmail, updateAvatar, sendEmailVerificationOtp, verifyEmailVerificationOtp };
