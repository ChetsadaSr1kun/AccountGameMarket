const { z } = require("zod");
const { normalizeThaiPhone } = require('../utils/phone');

const newUsername = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(30, "Username must be 30 characters or fewer.")
  .regex(/^[A-Za-z0-9_]+$/, "Username may contain only letters, numbers, and underscores.");

const newEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email is invalid.")
  .max(254, "Email must be 254 characters or fewer.");

const updateUsernameSchema = z.object({ newUsername });
const updateEmailSchema = z.object({ newEmail });
const newPhone = z.preprocess(
  normalizeThaiPhone,
  z.string().regex(/^0\d{9}$/, 'Phone must be a 10-digit Thai mobile number.'),
);
const updatePhoneSchema = z.object({ newPhone });
const verificationOtp = z.string().regex(/^\d{6}$/, 'OTP must contain exactly 6 digits.');
const verifyEmailOtpSchema = z.object({ otp: verificationOtp });
const verifyPhoneOtpSchema = z.object({ otp: verificationOtp });

module.exports = { updateUsernameSchema, updateEmailSchema, updatePhoneSchema, verifyEmailOtpSchema, verifyPhoneOtpSchema };
