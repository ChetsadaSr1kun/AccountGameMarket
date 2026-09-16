'use strict';

const userRepository = require('../repositories/user.repository');
const { publicUser } = require('./user.service');
const smsService = require('./sms.service');
const { normalizeThaiPhone } = require('../utils/phone');
const AppError = require('../utils/app-error');
const config = require('../config/env');
const { withTransaction } = require('../utils/transaction');

const CHANNEL = 'PHONE';

function canonicalPhone(phone) {
  const normalized = normalizeThaiPhone(phone);

  return typeof normalized === 'string' && /^0\d{9}$/.test(normalized)
    ? normalized
    : null;
}

async function sendPhoneOtp(userId) {
  const user = await userRepository.findAuthUserById(userId);

  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  if (user.phoneVerifiedAt) {
    throw new AppError(
      'Phone number is already verified.',
      409,
      'PHONE_ALREADY_VERIFIED'
    );
  }

  const phone = canonicalPhone(user.phone);

  if (!phone) {
    throw new AppError(
      'Phone number is unavailable for verification.',
      409,
      'PHONE_VERIFICATION_UNAVAILABLE'
    );
  }

  try {
    await smsService.sendPhoneVerificationOtp({
      phone: `+66${phone.slice(1)}`,
    });
  } catch (error) {
    console.error('sendPhoneOtp Twilio error:', error);

    throw new AppError(
      'Unable to send verification SMS. Please try again later.',
      503,
      'SMS_DELIVERY_FAILED'
    );
  }
}

async function verifyPhoneOtp(userId, otp) {
  const user = await userRepository.findAuthUserById(userId);

  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  if (user.phoneVerifiedAt) {
    throw new AppError(
      'Phone number is already verified.',
      409,
      'PHONE_ALREADY_VERIFIED'
    );
  }

  const phone = canonicalPhone(user.phone);

  if (!phone) {
    throw new AppError(
      'Phone number is unavailable for verification.',
      409,
      'PHONE_VERIFICATION_UNAVAILABLE'
    );
  }

  const normalizedOtp = String(otp || '').trim();

  if (!/^\d{6}$/.test(normalizedOtp)) {
    throw new AppError(
      'OTP must be a 6-digit code.',
      422,
      'INVALID_OTP_FORMAT'
    );
  }

  let verification;

  try {
    verification = await smsService.checkPhoneVerificationOtp({
      phone: `+66${phone.slice(1)}`,
      otp: normalizedOtp,
    });
  } catch (error) {
    console.error('verifyPhoneOtp Twilio error:', error);

    throw new AppError(
      'Unable to verify OTP. Please try again later.',
      503,
      'SMS_VERIFICATION_FAILED'
    );
  }

  if (verification?.status !== 'approved') {
    throw new AppError(
      'OTP is invalid or expired.',
      422,
      'OTP_INVALID_OR_EXPIRED'
    );
  }

  await withTransaction(async (connection) => {
    await userRepository.markPhoneVerified(connection, userId);
  });

  return publicUser(
    await userRepository.findAuthUserById(userId)
  );
}

module.exports = {
  sendPhoneOtp,
  verifyPhoneOtp,
  canonicalPhone,
};