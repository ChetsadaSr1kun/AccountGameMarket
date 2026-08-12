const authService = require('../services/auth.service');
const { createCsrfToken } = require('../utils/jwt');
const { setAuthenticationCookies, clearAuthenticationCookies } = require('../utils/cookies');
const { success } = require('../utils/response');
const asyncHandler = require('../utils/async-handler');

function requestMeta(req) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') || null };
}

function sendAuthenticated(res, statusCode, session) {
  const csrfToken = createCsrfToken();
  setAuthenticationCookies(res, { ...session, csrfToken });
  return success(res, statusCode, { user: session.user, csrfToken });
}

const register = asyncHandler(async (req, res) => sendAuthenticated(res, 201, await authService.register(req.validatedBody, requestMeta(req))));
const login = asyncHandler(async (req, res) => {
  return sendAuthenticated(
    res,
    200,
    await authService.login(req.validatedBody, requestMeta(req))
  );
});
const refresh = asyncHandler(async (req, res) => sendAuthenticated(res, 200, await authService.refresh(req.cookies.gm_refresh, requestMeta(req))));

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies.gm_refresh);
  clearAuthenticationCookies(res);
  return res.status(204).send();
});

const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.user.id);
  clearAuthenticationCookies(res);
  return res.status(204).send();
});

const me = asyncHandler(async (req, res) => success(res, 200, { user: req.user }));

const csrf = (req, res) => {
  const csrfToken = createCsrfToken();
  res.cookie('gm_csrf', csrfToken, { httpOnly: false, secure: require('../config/env').isProduction, sameSite: 'strict', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 });
  return success(res, 200, { csrfToken });
};

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.requestPasswordReset(req.validatedBody.email);
  return success(res, 200, { message: 'If the account exists, password reset instructions have been sent.' });
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.validatedBody);
  return success(res, 200, { message: 'Password has been reset. Please sign in again.' });
});

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.validatedBody);
  clearAuthenticationCookies(res);
  return success(res, 200, { message: 'Password changed. Please sign in again.' });
});

module.exports = { register, login, refresh, logout, logoutAll, me, csrf, forgotPassword, resetPassword, changePassword };
