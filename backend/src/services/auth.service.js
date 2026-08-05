const crypto = require('crypto');
const config = require('../config/env');
const userRepository = require('../repositories/user.repository');
const roleRepository = require('../repositories/role.repository');
const refreshTokenRepository = require('../repositories/refresh-token.repository');
const passwordResetTokenRepository = require('../repositories/password-reset-token.repository');
const emailService = require('./email.service');
const { withTransaction } = require('../utils/transaction');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signAccessToken, signRefreshToken, verifyToken, hashOpaqueToken, createResetToken, expiresAt } = require('../utils/jwt');
const AppError = require('../utils/app-error');

function publicUser(user) {
  return { id: user.id, email: user.email, username: user.username, roles: user.roles, accountMode: user.accountMode, status: user.status };
}

function registrationPolicy(accountType) {
  if (config.accountMode === 'UNIFIED') {
    return { accountMode: 'UNIFIED', roles: ['CUSTOMER', 'SELLER'] };
  }

  if (accountType === 'SELLER') return { accountMode: 'SELLER_ONLY', roles: ['SELLER'] };
  return { accountMode: 'CUSTOMER_ONLY', roles: ['CUSTOMER'] };
}

async function issueSession(user, meta, executor) {
  const tokenId = crypto.randomUUID();
  const familyId = crypto.randomUUID();
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, tokenId, familyId);
  await refreshTokenRepository.create(executor, {
    userId: user.id,
    tokenId,
    familyId,
    tokenHash: hashOpaqueToken(refreshToken),
    expiresAt: expiresAt(7),
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
  return { accessToken, refreshToken };
}

async function register(input, meta) {
  const passwordHash = await hashPassword(input.password);
  const policy = registrationPolicy(input.accountType);

  return withTransaction(async (connection) => {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw new AppError('Email or username is already in use.', 409, 'DUPLICATE_USER');
    const existingUsername = await userRepository.findByLogin(input.username);
    if (existingUsername) throw new AppError('Email or username is already in use.', 409, 'DUPLICATE_USER');

    const userId = await userRepository.create(connection, {
      email: input.email,
      username: input.username,
      passwordHash,
      accountMode: policy.accountMode,
    });
    const roleIds = await roleRepository.findIdsByCodes(connection, policy.roles);
    if (roleIds.some((roleId) => !roleId)) throw new AppError('Required roles are missing from the database.', 500, 'ROLE_SETUP_ERROR');
    await userRepository.assignRoles(connection, userId, roleIds);

    const user = await userRepository.findAuthUserById(userId, connection);
    const tokens = await issueSession(user, meta, connection);
    return { user: publicUser(user), ...tokens };
  });
}

async function login(input, meta) {
  const user = await userRepository.findByLogin(input.emailOrUsername);
  if (!user || user.status !== 'ACTIVE') throw new AppError('Email/username or password is incorrect.', 401, 'INVALID_CREDENTIALS');

  const passwordMatches = await verifyPassword(user.passwordHash, input.password);
  if (!passwordMatches) throw new AppError('Email/username or password is incorrect.', 401, 'INVALID_CREDENTIALS');

  return withTransaction(async (connection) => ({ user: publicUser(user), ...(await issueSession(user, meta, connection)) }));
}

async function refresh(refreshToken, meta) {
  if (!refreshToken) throw new AppError('Refresh token is required.', 401, 'MISSING_REFRESH_TOKEN');
  const payload = verifyToken(refreshToken, 'refresh');

  return withTransaction(async (connection) => {
    const storedToken = await refreshTokenRepository.findActiveForUpdate(connection, payload.jti);
    if (!storedToken || storedToken.revoked_at || storedToken.token_hash !== hashOpaqueToken(refreshToken)) {
      await refreshTokenRepository.revokeFamily(connection, payload.familyId);
      throw new AppError('Your session has expired. Please sign in again.', 401, 'REFRESH_TOKEN_REUSED');
    }

    const user = await userRepository.findAuthUserById(payload.sub);
    if (!user || user.status !== 'ACTIVE' || user.tokenVersion !== payload.ver) {
      await refreshTokenRepository.revokeFamily(connection, payload.familyId);
      throw new AppError('Your session has expired. Please sign in again.', 401, 'INVALID_SESSION');
    }

    const nextTokenId = crypto.randomUUID();
    const accessToken = signAccessToken(user);
    const nextRefreshToken = signRefreshToken(user, nextTokenId, storedToken.family_id);
    await refreshTokenRepository.revokeByTokenId(connection, storedToken.token_id, nextTokenId);
    await refreshTokenRepository.create(connection, {
      userId: user.id,
      tokenId: nextTokenId,
      familyId: storedToken.family_id,
      tokenHash: hashOpaqueToken(nextRefreshToken),
      expiresAt: expiresAt(7),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return { user: publicUser(user), accessToken, refreshToken: nextRefreshToken };
  });
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  try {
    const payload = verifyToken(refreshToken, 'refresh');
    await withTransaction((connection) => refreshTokenRepository.revokeByTokenId(connection, payload.jti));
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }
}

async function logoutAll(userId) {
  await withTransaction(async (connection) => {
    await refreshTokenRepository.revokeAllForUser(connection, userId);
    await userRepository.incrementTokenVersion(connection, userId);
  });
}

async function requestPasswordReset(email) {
  const user = await userRepository.findByEmail(email);
  if (!user || user.status !== 'ACTIVE') return;

  const rawToken = createResetToken();
  await withTransaction(async (connection) => {
    await passwordResetTokenRepository.invalidateUnusedForUser(connection, user.id);
    await passwordResetTokenRepository.create(connection, { userId: user.id, tokenHash: hashOpaqueToken(rawToken), expiresAt: new Date(Date.now() + 15 * 60 * 1000) });
  });

  const resetUrl = `${config.frontendUrl}/?resetToken=${encodeURIComponent(rawToken)}`;
  await emailService.sendPasswordResetEmail({ email: user.email, resetUrl });
}

async function resetPassword(input) {
  const tokenHash = hashOpaqueToken(input.token);
  const passwordHash = await hashPassword(input.newPassword);

  await withTransaction(async (connection) => {
    const resetToken = await passwordResetTokenRepository.findActiveForUpdate(connection, tokenHash);
    if (!resetToken) throw new AppError('Reset token is invalid or expired.', 400, 'INVALID_RESET_TOKEN');
    await userRepository.updatePassword(connection, resetToken.user_id, passwordHash);
    await userRepository.incrementTokenVersion(connection, resetToken.user_id);
    await refreshTokenRepository.revokeAllForUser(connection, resetToken.user_id);
    await passwordResetTokenRepository.markUsed(connection, resetToken.id);
  });
}

async function changePassword(userId, input) {
  const user = await userRepository.findAuthUserById(userId);
  const passwordMatches = user && await verifyPassword(user.passwordHash, input.currentPassword);
  if (!passwordMatches) throw new AppError('Current password is incorrect.', 401, 'INVALID_CREDENTIALS');

  const passwordHash = await hashPassword(input.newPassword);
  await withTransaction(async (connection) => {
    await userRepository.updatePassword(connection, userId, passwordHash);
    await userRepository.incrementTokenVersion(connection, userId);
    await refreshTokenRepository.revokeAllForUser(connection, userId);
  });
}

module.exports = { register, login, refresh, logout, logoutAll, requestPasswordReset, resetPassword, changePassword, publicUser };
