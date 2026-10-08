'use strict';

const withdrawalAttemptRepository = require('../repositories/withdrawal-attempt.repository');
const userRepository = require('../repositories/user.repository');
const emailService = require('./email.service');
const smsService = require('./sms.service');
const withdrawalService = require('./withdrawal.service');
const { normalizeThaiPhone } = require('../utils/phone');
const { withTransaction } = require('../utils/transaction');
const AppError = require('../utils/app-error');

const {
  generateOtp,
  hashOtp,
  matchesOtp,
} = require('../utils/verification-otp');

const MIN_WITHDRAWAL_AMOUNT = 100;
const MAX_WITHDRAWAL_AMOUNT = 100000;

const ATTEMPT_EXPIRY_MS = 15 * 60 * 1000;
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const allowedMethods = new Set([
  'BANK',
  'PROMPTPAY',
]);

const allowedBankCodes = new Set([
  'KBANK',
  'KTB',
  'GSB',
  'BBL',
  'SCB',
  'BAY',
  'TTB',
]);

function expiresAtMs(value) {
  return Date.parse(`${String(value).replace(' ', 'T')}Z`);
}

function canonicalPhone(phone) {
  const normalized = normalizeThaiPhone(phone);

  return typeof normalized === 'string' && /^\d{10}$/.test(normalized)
    ? normalized
    : null;
}

function mapAttempt(row) {
  if (!row) return null;

  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    amount: Number(row.amount),
    paymentMethod: row.payment_method,
    bankCode: row.bank_code || null,
    accountName: row.account_name,
    accountNumber: row.account_number,
    status: row.status,
    emailVerifiedAt: row.email_verified_at,
    phoneVerifiedAt: row.phone_verified_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateWithdrawalData(data) {
  const amount = Number(data.amount);
  const paymentMethod =
    String(data.paymentMethod || '').toUpperCase();

  const bankCode =
    String(data.bankCode || '').toUpperCase();

  const accountName =
    String(data.accountName || '').trim();

  const accountNumber =
    String(data.accountNumber || '').trim();

  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_AMOUNT) {
    throw new AppError(
      'Minimum withdrawal amount is 100.',
      400,
      'INVALID_WITHDRAWAL_AMOUNT'
    );
  }

  if (amount > MAX_WITHDRAWAL_AMOUNT) {
    throw new AppError(
      'Withdrawal amount is too high.',
      400,
      'INVALID_WITHDRAWAL_AMOUNT'
    );
  }

  if (!allowedMethods.has(paymentMethod)) {
    throw new AppError(
      'Unsupported withdrawal method.',
      400,
      'INVALID_WITHDRAWAL_METHOD'
    );
  }

  if (
    paymentMethod === 'BANK' &&
    !allowedBankCodes.has(bankCode)
  ) {
    throw new AppError(
      'A valid bank is required.',
      400,
      'INVALID_WITHDRAWAL_BANK'
    );
  }

  if (!accountName || !accountNumber) {
    throw new AppError(
      'Account information is required.',
      400,
      'INVALID_WITHDRAWAL_ACCOUNT'
    );
  }

  return {
    amount,
    paymentMethod,
    bankCode:
      paymentMethod === 'BANK'
        ? bankCode
        : null,
    accountName,
    accountNumber,
  };
}

async function findUserOrThrow(userId) {
  const user = await userRepository.findAuthUserById(userId);

  if (!user) {
    throw new AppError(
      'User not found.',
      404,
      'USER_NOT_FOUND'
    );
  }

  return user;
}

function assertAttemptActive(attempt, userId) {
  if (!attempt) {
    throw new AppError(
      'Withdrawal attempt not found.',
      404,
      'WITHDRAWAL_ATTEMPT_NOT_FOUND'
    );
  }

  if (Number(attempt.user_id) !== Number(userId)) {
    throw new AppError(
      'Withdrawal attempt does not belong to this account.',
      403,
      'WITHDRAWAL_ATTEMPT_FORBIDDEN'
    );
  }

  if (attempt.status !== 'PENDING') {
    throw new AppError(
      'Withdrawal attempt is no longer active.',
      409,
      'WITHDRAWAL_ATTEMPT_NOT_ACTIVE'
    );
  }

  if (expiresAtMs(attempt.expires_at) <= Date.now()) {
    throw new AppError(
      'Withdrawal attempt has expired.',
      410,
      'WITHDRAWAL_ATTEMPT_EXPIRED'
    );
  }
}

function assertEmailVerified(attempt) {
  if (!attempt.email_verified_at) {
    throw new AppError(
      'Email OTP must be verified first.',
      409,
      'EMAIL_OTP_REQUIRED'
    );
  }
}

function assertPhoneAvailable(user) {
  const phone = canonicalPhone(user.phone);

  if (!phone) {
    throw new AppError(
      'Phone number is unavailable for verification.',
      409,
      'PHONE_VERIFICATION_UNAVAILABLE'
    );
  }

  return phone;
}

async function createAttempt(userId, data) {
  await findUserOrThrow(userId);

  const withdrawal = validateWithdrawalData(data);

  const expiresAt = new Date(Date.now() + ATTEMPT_EXPIRY_MS);

  const attempt = await withdrawalAttemptRepository.createAttempt({
    userId,
    ...withdrawal,
    expiresAt,
  });

  return mapAttempt(attempt);
}

async function getAttempt(userId, attemptId) {
  const attempt = await withdrawalAttemptRepository.findById(attemptId);

  assertAttemptActive(attempt, userId);

  return mapAttempt(attempt);
}

async function sendEmailOtp(userId, attemptId) {
  const user = await findUserOrThrow(userId);

  const result = await withTransaction(async (connection) => {
    const attempt =
      await withdrawalAttemptRepository.findByIdForUpdate(
        attemptId,
        connection
      );

    assertAttemptActive(attempt, userId);

    if (attempt.email_verified_at) {
      throw new AppError(
        'Email OTP is already verified.',
        409,
        'EMAIL_OTP_ALREADY_VERIFIED'
      );
    }

    const activeOtp =
      await withdrawalAttemptRepository.findActiveOtpForUpdate(
        attemptId,
        'EMAIL',
        connection
      );

    if (
      activeOtp &&
      Date.now() - expiresAtMs(activeOtp.created_at) <
        RESEND_COOLDOWN_MS
    ) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(
          (
            RESEND_COOLDOWN_MS -
            (Date.now() - expiresAtMs(activeOtp.created_at))
          ) / 1000
        )
      );

      const error = new AppError(
        'Please wait before requesting another OTP.',
        429,
        'OTP_RESEND_COOLDOWN'
      );

      error.retryAfterSeconds = retryAfterSeconds;

      throw error;
    }

    const otp = generateOtp();

    const record =
      await withdrawalAttemptRepository.createOrReplaceOtp(
        connection,
        {
          withdrawalAttemptId: attemptId,
          channel: 'EMAIL',
          otpHash: hashOtp(otp),
          expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
        }
      );

    return {
      otp,
      otpId: Number(record.id),
      email: user.email,
    };
  });

  try {
    await emailService.sendEmailVerificationOtp({
      email: result.email,
      otp: result.otp,
    });
  } catch (error) {
    await withTransaction((connection) =>
      withdrawalAttemptRepository.invalidateOtp(
        result.otpId,
        connection
      )
    );

    throw new AppError(
      'Unable to send withdrawal verification email. Please try again later.',
      503,
      'EMAIL_DELIVERY_FAILED'
    );
  }

  return {
    sent: true,
  };
}

async function verifyEmailOtp(userId, attemptId, otp) {
  const normalizedOtp = String(otp || '').trim();

  if (!/^\d{6}$/.test(normalizedOtp)) {
    throw new AppError(
      'OTP must be a 6-digit code.',
      422,
      'INVALID_OTP_FORMAT'
    );
  }

  const result = await withTransaction(async (connection) => {
    const attempt =
      await withdrawalAttemptRepository.findByIdForUpdate(
        attemptId,
        connection
      );

    assertAttemptActive(attempt, userId);

    const record =
      await withdrawalAttemptRepository.findActiveOtpForUpdate(
        attemptId,
        'EMAIL',
        connection
      );

    if (!record) {
      return new AppError(
        'OTP is invalid or expired.',
        422,
        'OTP_INVALID_OR_EXPIRED'
      );
    }

    if (expiresAtMs(record.expires_at) <= Date.now()) {
      await withdrawalAttemptRepository.invalidateOtp(
        record.id,
        connection
      );

      return new AppError(
        'OTP is invalid or expired.',
        422,
        'OTP_INVALID_OR_EXPIRED'
      );
    }

    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      await withdrawalAttemptRepository.invalidateOtp(
        record.id,
        connection
      );

      return new AppError(
        'OTP attempt limit has been reached.',
        429,
        'OTP_ATTEMPTS_EXCEEDED'
      );
    }

    if (!matchesOtp(normalizedOtp, record.otp_hash)) {
      await withdrawalAttemptRepository.incrementOtpAttempts(
        record.id,
        connection
      );

      if (record.attempts + 1 >= MAX_OTP_ATTEMPTS) {
        await withdrawalAttemptRepository.invalidateOtp(
          record.id,
          connection
        );

        return new AppError(
          'OTP attempt limit has been reached.',
          429,
          'OTP_ATTEMPTS_EXCEEDED'
        );
      }

      return new AppError(
        'OTP is invalid or expired.',
        422,
        'OTP_INVALID_OR_EXPIRED'
      );
    }

    await withdrawalAttemptRepository.markOtpUsed(
      record.id,
      connection
    );

    const updated =
      await withdrawalAttemptRepository.markEmailVerified(
        attemptId,
        connection
      );

    return mapAttempt(updated);
  });

  // Commit OTP counters/invalidation before surfacing the unchanged API error.
  if (result instanceof AppError) throw result;
  return result;
}

async function sendPhoneOtp(userId, attemptId) {
  const user = await findUserOrThrow(userId);

  const result = await withTransaction(async (connection) => {
    const attempt =
      await withdrawalAttemptRepository.findByIdForUpdate(
        attemptId,
        connection
      );

    assertAttemptActive(attempt, userId);
    assertEmailVerified(attempt);

    if (attempt.phone_verified_at) {
      throw new AppError(
        'Phone OTP is already verified.',
        409,
        'PHONE_OTP_ALREADY_VERIFIED'
      );
    }

    const phone = assertPhoneAvailable(user);

    const activeOtp =
      await withdrawalAttemptRepository.findActiveOtpForUpdate(
        attemptId,
        'PHONE',
        connection
      );

    if (
      activeOtp &&
      Date.now() - expiresAtMs(activeOtp.created_at) <
        RESEND_COOLDOWN_MS
    ) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(
          (
            RESEND_COOLDOWN_MS -
            (Date.now() - expiresAtMs(activeOtp.created_at))
          ) / 1000
        )
      );

      const error = new AppError(
        'Please wait before requesting another OTP.',
        429,
        'OTP_RESEND_COOLDOWN'
      );

      error.retryAfterSeconds = retryAfterSeconds;

      throw error;
    }

    try {
      const verification =
        await smsService.sendPhoneVerificationOtp({
          phone: `+66${phone.slice(1)}`,
        });

      const providerReference = verification?.sid || null;

      await withdrawalAttemptRepository.createOrReplaceOtp(
        connection,
        {
          withdrawalAttemptId: attemptId,
          channel: 'PHONE',
          otpHash: null,
          providerReference,
          expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
        }
      );

      return {
        sent: true,
        providerReference,
      };
    } catch (error) {
      console.error(
        'sendWithdrawalPhoneOtp Twilio error:',
        error
      );

      throw new AppError(
        'Unable to send withdrawal verification SMS. Please try again later.',
        503,
        'SMS_DELIVERY_FAILED'
      );
    }
  });

  return result;
}

async function verifyPhoneOtp(userId, attemptId, otp) {
  const user = await findUserOrThrow(userId);

  const normalizedOtp = String(otp || '').trim();

  if (!/^\d{6}$/.test(normalizedOtp)) {
    throw new AppError(
      'OTP must be a 6-digit code.',
      422,
      'INVALID_OTP_FORMAT'
    );
  }

  const attempt =
    await withdrawalAttemptRepository.findById(attemptId);

  assertAttemptActive(attempt, userId);
  assertEmailVerified(attempt);

  if (attempt.phone_verified_at) {
    throw new AppError(
      'Phone OTP is already verified.',
      409,
      'PHONE_OTP_ALREADY_VERIFIED'
    );
  }

  const phone = assertPhoneAvailable(user);

  let verification;

  try {
    verification =
      await smsService.checkPhoneVerificationOtp({
        phone: `+66${phone.slice(1)}`,
        otp: normalizedOtp,
      });
  } catch (error) {
    console.error(
      'verifyWithdrawalPhoneOtp Twilio error:',
      error
    );

    throw new AppError(
      'Unable to verify withdrawal OTP. Please try again later.',
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

    const result = await withTransaction(async (connection) => {
      const currentAttempt =
        await withdrawalAttemptRepository.findByIdForUpdate(
          attemptId,
          connection
        );

      assertAttemptActive(currentAttempt, userId);
      assertEmailVerified(currentAttempt);

      if (currentAttempt.phone_verified_at) {
        return new AppError(
          'Phone OTP is already verified.',
          409,
          'PHONE_OTP_ALREADY_VERIFIED'
        );
      }

      const otpRecord =
        await withdrawalAttemptRepository.findActiveOtpForUpdate(
          attemptId,
          'PHONE',
          connection
        );

      if (!otpRecord) {
        return new AppError(
          'Phone OTP is invalid or expired.',
          422,
          'OTP_INVALID_OR_EXPIRED'
        );
      }

      if (expiresAtMs(otpRecord.expires_at) <= Date.now()) {
        await withdrawalAttemptRepository.invalidateOtp(
          otpRecord.id,
          connection
        );

        return new AppError(
          'Phone OTP is invalid or expired.',
          422,
          'OTP_INVALID_OR_EXPIRED'
        );
      }

      await withdrawalAttemptRepository.markOtpUsed(
        otpRecord.id,
        connection
      );

      const updated =
        await withdrawalAttemptRepository.markPhoneVerified(
          attemptId,
          connection
        );

      return mapAttempt(updated);
    });

    // Commit OTP counters/invalidation before surfacing the unchanged API error.
    if (result instanceof AppError) throw result;
    return result;
  }

async function markCompleted(userId, attemptId) {
  const result = await withTransaction(async (connection) => {
    const attempt =
      await withdrawalAttemptRepository.findByIdForUpdate(
        attemptId,
        connection
      );

    assertAttemptActive(attempt, userId);

    if (!attempt.email_verified_at) {
      throw new AppError(
        'Email OTP must be verified first.',
        409,
        'EMAIL_OTP_REQUIRED'
      );
    }

    if (!attempt.phone_verified_at) {
      throw new AppError(
        'Phone OTP must be verified first.',
        409,
        'PHONE_OTP_REQUIRED'
      );
    }

    const withdrawal =
      await withdrawalService.createRequestWithConnection(
        userId,
        {
          amount: attempt.amount,
          paymentMethod: attempt.payment_method,
          bankCode: attempt.bank_code,
          accountName: attempt.account_name,
          accountNumber: attempt.account_number,
        },
        connection,
        attempt.id
      );

    const completed =
      await withdrawalAttemptRepository.completeAttempt(
        attemptId,
        connection
      );

    return {
      ...mapAttempt(completed),
      withdrawalRequestId: withdrawal.id,
    };
  });

  return result;
}

async function cancelAttempt(userId, attemptId) {
  const result = await withTransaction(async (connection) => {
    const attempt =
      await withdrawalAttemptRepository.findByIdForUpdate(
        attemptId,
        connection
      );

    if (!attempt) {
      throw new AppError(
        'Withdrawal attempt not found.',
        404,
        'WITHDRAWAL_ATTEMPT_NOT_FOUND'
      );
    }

    if (Number(attempt.user_id) !== Number(userId)) {
      throw new AppError(
        'Withdrawal attempt does not belong to this account.',
        403,
        'WITHDRAWAL_ATTEMPT_FORBIDDEN'
      );
    }

    const cancelled =
      await withdrawalAttemptRepository.cancelAttempt(
        attemptId,
        connection
      );

    return mapAttempt(cancelled);
  });

  return result;
}

module.exports = {
  createAttempt,
  getAttempt,
  sendEmailOtp,
  verifyEmailOtp,
  sendPhoneOtp,
  verifyPhoneOtp,
  markCompleted,
  cancelAttempt,
};
