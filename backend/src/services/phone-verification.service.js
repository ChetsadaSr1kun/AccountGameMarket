'use strict';

const userRepository = require('../repositories/user.repository');
const otpRepository = require('../repositories/user-verification-otp.repository');
const smsService = require('./sms.service');
const { publicUser } = require('./user.service');
const { normalizeThaiPhone } = require('../utils/phone');
const { withTransaction } = require('../utils/transaction');
const AppError = require('../utils/app-error');
const { generateOtp, hashOtp, matchesOtp } = require('../utils/verification-otp');

const CHANNEL = 'PHONE';
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function dateTimeMs(dateTime) {
  return Date.parse(`${String(dateTime).replace(' ', 'T')}Z`);
}

function canonicalPhone(phone) {
  const normalized = normalizeThaiPhone(phone);
  return typeof normalized === 'string' && /^0\d{9}$/.test(normalized) ? normalized : null;
}

async function sendPhoneOtp(userId) {
  const user = await userRepository.findAuthUserById(userId);
  if (!user) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  if (user.phoneVerifiedAt) throw new AppError('Phone number is already verified.', 409, 'PHONE_ALREADY_VERIFIED');

  const phone = canonicalPhone(user.phone);
  if (!phone) throw new AppError('Phone number is unavailable for verification.', 409, 'PHONE_VERIFICATION_UNAVAILABLE');

  const otp = generateOtp();
  const result = await withTransaction(async (connection) => {
    const activeOtp = await otpRepository.findLatestActiveForUpdate(connection, userId, CHANNEL);
    if (activeOtp && Date.now() - dateTimeMs(activeOtp.created_at) < RESEND_COOLDOWN_MS) {
      return { error: new AppError('Please wait before requesting another OTP.', 429, 'OTP_RESEND_COOLDOWN') };
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
    await smsService.sendPhoneVerificationOtp({ phone, otp });
  } catch (error) {
    await withTransaction((connection) => otpRepository.invalidateById(connection, result.otpId));
    throw new AppError('Unable to send verification SMS. Please try again later.', 503, 'SMS_DELIVERY_FAILED');
  }
}

async function verifyPhoneOtp(userId, otp) {
  const outcome = await withTransaction(async (connection) => {
    const record = await otpRepository.findLatestActiveForUpdate(connection, userId, CHANNEL);
    if (!record) return { error: new AppError('OTP is invalid or expired.', 422, 'OTP_INVALID_OR_EXPIRED') };

    if (dateTimeMs(record.expires_at) <= Date.now()) {
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
    await userRepository.markPhoneVerified(connection, userId);
    return { verified: true };
  });

  if (outcome.error) throw outcome.error;
  return publicUser(await userRepository.findAuthUserById(userId));
}

module.exports = { sendPhoneOtp, verifyPhoneOtp, canonicalPhone };
