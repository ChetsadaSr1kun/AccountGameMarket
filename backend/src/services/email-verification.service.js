'use strict';

const userRepository = require('../repositories/user.repository');
const otpRepository = require('../repositories/user-verification-otp.repository');
const emailService = require('./email.service');
const { publicUser } = require('./user.service');
const { withTransaction } = require('../utils/transaction');
const AppError = require('../utils/app-error');
const { generateOtp, hashOtp, matchesOtp } = require('../utils/verification-otp');

const CHANNEL = 'EMAIL';
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function expiresAtMs(expiresAt) {
  return Date.parse(`${String(expiresAt).replace(' ', 'T')}Z`);
}

function resendCooldownError(createdAt) {
  const retryAfterSeconds = Math.max(1, Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - expiresAtMs(createdAt))) / 1000));
  const error = new AppError('Please wait before requesting another OTP.', 429, 'OTP_RESEND_COOLDOWN');
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

async function sendEmailOtp(userId) {
  const user = await userRepository.findAuthUserById(userId);
  if (!user) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  if (user.emailVerifiedAt) throw new AppError('Email is already verified.', 409, 'EMAIL_ALREADY_VERIFIED');

  const otp = generateOtp();
  const result = await withTransaction(async (connection) => {
    const activeOtp = await otpRepository.findLatestActiveForUpdate(connection, userId, CHANNEL);
    if (activeOtp && Date.now() - expiresAtMs(activeOtp.created_at) < RESEND_COOLDOWN_MS) {
      return { error: resendCooldownError(activeOtp.created_at) };
    }
    await otpRepository.invalidateActiveForUserChannel(connection, userId, CHANNEL);
    const otpId = await otpRepository.create(connection, {
      userId,
      channel: CHANNEL,
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    });
    return { otpId };
  });

  if (result.error) throw result.error;

  try {
    await emailService.sendEmailVerificationOtp({ email: user.email, otp });
  } catch (error) {
    await withTransaction((connection) => otpRepository.invalidateById(connection, result.otpId));
    throw new AppError('Unable to send verification email. Please try again later.', 503, 'EMAIL_DELIVERY_FAILED');
  }
}

async function verifyEmailOtp(userId, otp) {
  const outcome = await withTransaction(async (connection) => {
    const record = await otpRepository.findLatestActiveForUpdate(connection, userId, CHANNEL);
    if (!record) return { error: new AppError('OTP is invalid or expired.', 422, 'OTP_INVALID_OR_EXPIRED') };

    if (expiresAtMs(record.expires_at) <= Date.now()) {
      await otpRepository.invalidateById(connection, record.id);
      return { error: new AppError('OTP is invalid or expired.', 422, 'OTP_INVALID_OR_EXPIRED') };
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await otpRepository.invalidateById(connection, record.id);
      return { error: new AppError('OTP attempt limit has been reached.', 429, 'OTP_ATTEMPTS_EXCEEDED') };
    }

    if (!matchesOtp(otp, record.otp_hash)) {
      await otpRepository.incrementAttempts(connection, record.id);
      if (record.attempts + 1 >= MAX_ATTEMPTS) {
        await otpRepository.invalidateById(connection, record.id);
        return { error: new AppError('OTP attempt limit has been reached.', 429, 'OTP_ATTEMPTS_EXCEEDED') };
      }
      return { error: new AppError('OTP is invalid or expired.', 422, 'OTP_INVALID_OR_EXPIRED') };
    }

    await otpRepository.markUsed(connection, record.id);
    await userRepository.markEmailVerified(connection, userId);
    return { verified: true };
  });

  if (outcome.error) throw outcome.error;

  const user = await userRepository.findAuthUserById(userId);
  return publicUser(user);
}

module.exports = { sendEmailOtp, verifyEmailOtp };
