'use strict';

const crypto = require('crypto');
const config = require('../config/env');

function generateOtp() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function hashOtp(otp) {
  return crypto.createHmac('sha256', config.verificationOtpSecret).update(otp).digest('hex');
}

function matchesOtp(otp, storedHash) {
  const candidate = Buffer.from(hashOtp(otp), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}

module.exports = { generateOtp, hashOtp, matchesOtp };
