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
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    name: process.env.DB_NAME || 'gamemarket',
    user: process.env.DB_USER || 'gamemarket_app',
    password: process.env.DB_PASSWORD || '',
  },
  emailEnabled: process.env.EMAIL_ENABLED === 'true',
};
