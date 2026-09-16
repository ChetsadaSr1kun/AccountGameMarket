'use strict';

const withdrawalAttemptService =
  require('../services/withdrawal-attempt.service');
const asyncHandler = require('../utils/async-handler');
const { success } = require('../utils/response');

const createAttempt = asyncHandler(async (req, res) => {
  const attempt = await withdrawalAttemptService.createAttempt(
    req.user.id,
    req.body
  );

  return success(res, 201, { attempt });
});

const getAttempt = asyncHandler(async (req, res) => {
  const attempt = await withdrawalAttemptService.getAttempt(
    req.user.id,
    req.params.attemptId
  );

  return success(res, 200, { attempt });
});

const sendEmailOtp = asyncHandler(async (req, res) => {
  const result = await withdrawalAttemptService.sendEmailOtp(
    req.user.id,
    req.params.attemptId
  );

  return success(res, 200, result);
});

const verifyEmailOtp = asyncHandler(async (req, res) => {
  const result = await withdrawalAttemptService.verifyEmailOtp(
    req.user.id,
    req.params.attemptId,
    req.body.otp
  );

  return success(res, 200, { attempt: result });
});

const sendPhoneOtp = asyncHandler(async (req, res) => {
  const result = await withdrawalAttemptService.sendPhoneOtp(
    req.user.id,
    req.params.attemptId
  );

  return success(res, 200, result);
});

const verifyPhoneOtp = asyncHandler(async (req, res) => {
  const result = await withdrawalAttemptService.verifyPhoneOtp(
    req.user.id,
    req.params.attemptId,
    req.body.otp
  );

  return success(res, 200, { attempt: result });
});

const completeAttempt = asyncHandler(async (req, res) => {
  const attempt = await withdrawalAttemptService.markCompleted(
    req.user.id,
    req.params.attemptId
  );

  return success(res, 200, { attempt });
});

const cancelAttempt = asyncHandler(async (req, res) => {
  const attempt = await withdrawalAttemptService.cancelAttempt(
    req.user.id,
    req.params.attemptId
  );

  return success(res, 200, { attempt });
});

module.exports = {
  createAttempt,
  getAttempt,
  sendEmailOtp,
  verifyEmailOtp,
  sendPhoneOtp,
  verifyPhoneOtp,
  completeAttempt,
  cancelAttempt,
};