const config = require('../config/env');
const common = { secure: config.isProduction, sameSite: 'strict' };

function setAuthenticationCookies(res, { accessToken, refreshToken, csrfToken }) {
  res.cookie('gm_access', accessToken, { ...common, httpOnly: true, path: '/', maxAge: 15 * 60 * 1000 });
  res.cookie('gm_refresh', refreshToken, { ...common, httpOnly: true, path: '/api/v1/auth', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.cookie('gm_csrf', csrfToken, { ...common, httpOnly: false, path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 });
}

function clearAuthenticationCookies(res) {
  res.clearCookie('gm_access', { ...common, httpOnly: true, path: '/' });
  res.clearCookie('gm_refresh', { ...common, httpOnly: true, path: '/api/v1/auth' });
  res.clearCookie('gm_csrf', { ...common, httpOnly: false, path: '/' });
}

module.exports = { setAuthenticationCookies, clearAuthenticationCookies };
