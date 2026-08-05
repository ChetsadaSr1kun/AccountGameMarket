const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const AppError = require('./app-error');

function tokenPayload(user, type, extra = {}) {
  return { sub: String(user.id), roles: user.roles, ver: user.tokenVersion, type, ...extra };
}

function signAccessToken(user) {
  return jwt.sign(tokenPayload(user, 'access'), config.jwt.accessSecret, {
    algorithm: 'HS256', issuer: config.jwt.issuer, audience: config.jwt.audience, expiresIn: config.jwt.accessExpiresIn,
  });
}

function signRefreshToken(user, tokenId, familyId) {
  return jwt.sign(tokenPayload(user, 'refresh', { jti: tokenId, familyId }), config.jwt.refreshSecret, {
    algorithm: 'HS256', issuer: config.jwt.issuer, audience: config.jwt.audience, expiresIn: config.jwt.refreshExpiresIn,
  });
}

function verifyToken(token, type) {
  try {
    const secret = type === 'access' ? config.jwt.accessSecret : config.jwt.refreshSecret;
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: config.jwt.issuer, audience: config.jwt.audience });
    if (payload.type !== type) throw new AppError('Invalid token type.', 401, 'INVALID_TOKEN');
    return payload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Your session is invalid or has expired.', 401, 'INVALID_TOKEN');
  }
}

function hashOpaqueToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function createResetToken() { return crypto.randomBytes(32).toString('base64url'); }
function createCsrfToken() { return crypto.randomBytes(32).toString('base64url'); }
function expiresAt(days) { return new Date(Date.now() + days * 24 * 60 * 60 * 1000); }

module.exports = { signAccessToken, signRefreshToken, verifyToken, hashOpaqueToken, createResetToken, createCsrfToken, expiresAt };
