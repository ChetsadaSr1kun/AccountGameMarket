const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const isProduction = process.env.NODE_ENV === 'production';

function readSecret(name) {
  if (process.env[name]) return process.env[name];

  if (isProduction) {
    throw new Error(`${name} must be configured in production.`);
  }

  return crypto.randomBytes(48).toString('base64url');
}

const accountMode = (process.env.ACCOUNT_MODE || 'SPLIT').toUpperCase();
if (!['SPLIT', 'UNIFIED'].includes(accountMode)) {
  throw new Error('ACCOUNT_MODE must be SPLIT or UNIFIED.');
}

const emailEnabled = process.env.EMAIL_ENABLED === 'true';

// Validate SMTP config at startup when email is enabled.
// Fail fast so misconfiguration is caught before any email is attempted.
if (emailEnabled) {
  if (!process.env.SMTP_HOST) throw new Error('SMTP_HOST is required when EMAIL_ENABLED=true.');
  if (!process.env.SMTP_PORT) throw new Error('SMTP_PORT is required when EMAIL_ENABLED=true.');
  if (!process.env.EMAIL_FROM) throw new Error('EMAIL_FROM is required when EMAIL_ENABLED=true.');
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  isProduction,
  port: Number(process.env.PORT || 3000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  accountMode,
  jwt: {
    issuer: 'gamemarket-api',
    audience: 'gamemarket-web',
    accessSecret: readSecret('JWT_ACCESS_SECRET'),
    refreshSecret: readSecret('JWT_REFRESH_SECRET'),
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
  },
  verificationOtpSecret: readSecret('VERIFICATION_OTP_SECRET'),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    name: process.env.DB_NAME || 'gamemarket',
    user: process.env.DB_USER || 'gamemarket_app',
    password: process.env.DB_PASSWORD || '',
  },
  emailEnabled,
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 1025),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || '',
  },
};
