const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const { pool } = require('../../backend/src/config/database');
const { hashPassword } = require('../../backend/src/utils/password');

if (process.env.NODE_ENV !== 'test' || process.env.DB_NAME !== 'gamemarket_test') {
  throw new Error('Run authentication tests with npm test so the test database safety guard is active.');
}

const app = require('../../backend/src/app');
const {
  cleanupTestUsers,
  closeTestDatabasePool,
  prepareTestDatabase,
} = require('../helpers/test-database');

const api = request(app);
const runId = crypto.randomUUID().replaceAll('-', '');
const emailPrefix = `authtest_${runId}_`;
const rateLimitIp = '203.0.113.240';

function userPayload(label, overrides = {}) {
  const labelId = crypto.createHash('sha256').update(label).digest('hex').slice(0, 8);
  return {
    email: `${emailPrefix}${label}@example.test`,
    username: `test_${runId.slice(0, 16)}_${labelId}`,
    password: 'TestPassword123',
    firstName: 'Test',
    lastName: 'User',
    phone: '+66812345678',
    dateOfBirth: '2000-01-01',
    accountType: 'CUSTOMER',
    ...overrides,
  };
}

function cookiesFrom(response) {
  return response.headers['set-cookie'] || [];
}

function cookieValue(cookies, name) {
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  return cookie ? cookie.split(';', 1)[0].slice(name.length + 1) : null;
}

function cookieHeader(cookies) {
  return cookies.map((value) => value.split(';', 1)[0]).join('; ');
}

function assertPersonalInfo(user, expected) {
  assert.equal(user.firstName, expected.firstName);
  assert.equal(user.lastName, expected.lastName);
  assert.equal(user.phone, expected.phone);
}

function assertPersonalProfile(user, expected) {
  assertPersonalInfo(user, expected);
  assert.equal(user.dateOfBirth, expected.dateOfBirth);
  assert.equal(user.avatarUrl, expected.avatarUrl);
  assert.equal(user.emailVerified, expected.emailVerified ?? false);
  assert.equal(user.phoneVerified, expected.phoneVerified ?? false);
  assert.equal(user.accountVerified, expected.accountVerified ?? false);
}

async function registerUser(label, overrides) {
  const response = await api.post('/api/v1/auth/register').send(userPayload(label, overrides));
  assert.equal(response.status, 201);
  return response;
}

async function createLegacyUser(label) {
  const payload = userPayload(label);
  const passwordHash = await hashPassword(payload.password);
  await pool.execute(
    'INSERT INTO users (email, username, first_name, last_name, phone, date_of_birth, avatar_url, password_hash, account_mode) VALUES (?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?)',
    [payload.email, payload.username, passwordHash, 'CUSTOMER_ONLY'],
  );
  return payload;
}

before(async () => {
  await prepareTestDatabase();
  await cleanupTestUsers(emailPrefix);
});

after(async () => {
  await cleanupTestUsers(emailPrefix);
  await closeTestDatabasePool();
});

test('registers a valid user and returns authentication cookies', async () => {
  const payload = userPayload('register-success');
  const response = await api.post('/api/v1/auth/register').send(payload);

  assert.equal(response.status, 201);
  assert.equal(response.body.data.user.email, payload.email);
  assert.equal(response.body.data.user.username, payload.username);
  assertPersonalProfile(response.body.data.user, { firstName: 'Test', lastName: 'User', phone: '+66812345678', dateOfBirth: '2000-01-01', avatarUrl: null });
  assert.ok(cookieValue(cookiesFrom(response), 'gm_access'));
  assert.ok(cookieValue(cookiesFrom(response), 'gm_refresh'));
  assert.ok(cookieValue(cookiesFrom(response), 'gm_csrf'));
});

test('registers required personal information and birthday in the user response', async () => {
  const personalInfo = { firstName: 'Test', lastName: 'User', phone: '+66812345678', dateOfBirth: '1999-12-31' };
  const response = await api.post('/api/v1/auth/register').send(userPayload('register-personal-info', personalInfo));

  assert.equal(response.status, 201);
  assertPersonalProfile(response.body.data.user, { ...personalInfo, avatarUrl: null });
});

test('/auth/me returns persisted personal information', async () => {
  const personalInfo = { firstName: 'Profile', lastName: 'Owner', phone: '+66823456789', dateOfBirth: '1998-02-28' };
  const registration = await registerUser('me-personal-info', personalInfo);
  const response = await api
    .get('/api/v1/auth/me')
    .set('Cookie', cookieHeader(cookiesFrom(registration)));

  assert.equal(response.status, 200);
  assertPersonalProfile(response.body.data.user, { ...personalInfo, avatarUrl: null });
});

test('/auth/me returns null personal information for a legacy user', async () => {
  const payload = await createLegacyUser('me-no-personal-info');
  const login = await api.post('/api/v1/auth/login').send({ emailOrUsername: payload.email, password: payload.password });
  const response = await api
    .get('/api/v1/auth/me')
    .set('Cookie', cookieHeader(cookiesFrom(login)));

  assert.equal(login.status, 200);
  assert.equal(response.status, 200);
  assertPersonalProfile(response.body.data.user, { firstName: null, lastName: null, phone: null, dateOfBirth: null, avatarUrl: null });
});

test('rejects a duplicate email', async () => {
  const first = userPayload('duplicate-email');
  await registerUser('duplicate-email');
  const response = await api.post('/api/v1/auth/register').send({ ...first, username: userPayload('duplicate-email-unique').username });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'DUPLICATE_USER');
});

test('rejects a duplicate username', async () => {
  const first = userPayload('duplicate-username');
  await registerUser('duplicate-username');
  const response = await api.post('/api/v1/auth/register').send({ ...first, email: `${emailPrefix}different-username@example.test` });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'DUPLICATE_USER');
});

test('rejects an invalid registration email', async () => {
  const response = await api.post('/api/v1/auth/register').send(userPayload('invalid-email', { email: 'not-an-email' }));

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('rejects a registration password that fails requirements', async () => {
  const response = await api.post('/api/v1/auth/register').send(userPayload('weak-password', { password: 'password' }));

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('logs in with valid credentials and returns authentication cookies', async () => {
  const payload = userPayload('login-success');
  await registerUser('login-success');
  const response = await api.post('/api/v1/auth/login').send({
    emailOrUsername: payload.email,
    password: payload.password,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.user.email, payload.email);
  assert.ok(cookieValue(cookiesFrom(response), 'gm_access'));
  assert.ok(cookieValue(cookiesFrom(response), 'gm_refresh'));
  assert.ok(cookieValue(cookiesFrom(response), 'gm_csrf'));
});

test('login returns the same personal information user shape', async () => {
  const personalInfo = { firstName: 'Login', lastName: 'User', phone: '+66834567890', dateOfBirth: '1997-03-15' };
  const payload = userPayload('login-personal-info', personalInfo);
  await registerUser('login-personal-info', personalInfo);
  const response = await api.post('/api/v1/auth/login').send({
    emailOrUsername: payload.email,
    password: payload.password,
  });

  assert.equal(response.status, 200);
  assertPersonalProfile(response.body.data.user, { ...personalInfo, avatarUrl: null });
});

test('rejects login with an incorrect password', async () => {
  const payload = userPayload('wrong-password');
  await registerUser('wrong-password');
  const response = await api.post('/api/v1/auth/login').send({
    emailOrUsername: payload.email,
    password: 'WrongPassword123',
  });

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'INVALID_CREDENTIALS');
});

test('rejects login for a user that does not exist', async () => {
  const response = await api.post('/api/v1/auth/login').send({
    emailOrUsername: `${emailPrefix}missing@example.test`,
    password: 'TestPassword123',
  });

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'INVALID_CREDENTIALS');
});

test('/auth/me returns the authenticated user with a valid access cookie', async () => {
  const registration = await registerUser('me-session');
  const response = await api
    .get('/api/v1/auth/me')
    .set('Cookie', cookieHeader(cookiesFrom(registration)));

  assert.equal(response.status, 200);
  assert.equal(response.body.data.user.email, userPayload('me-session').email);
});

test('/auth/me rejects a request without an access cookie', async () => {
  const response = await api.get('/api/v1/auth/me');

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'UNAUTHENTICATED');
});

test('rotates a valid refresh token and rejects its reuse', async () => {
  const registration = await registerUser('refresh-rotation');
  const originalCookies = cookiesFrom(registration);
  const originalRefreshToken = cookieValue(originalCookies, 'gm_refresh');
  const refreshResponse = await api
    .post('/api/v1/auth/refresh')
    .set('Cookie', cookieHeader(originalCookies));
  const nextRefreshToken = cookieValue(cookiesFrom(refreshResponse), 'gm_refresh');

  assert.equal(refreshResponse.status, 200);
  assert.ok(nextRefreshToken);
  assert.notEqual(nextRefreshToken, originalRefreshToken);

  const reuseResponse = await api
    .post('/api/v1/auth/refresh')
    .set('Cookie', `gm_refresh=${originalRefreshToken}`);

  assert.equal(reuseResponse.status, 401);
  assert.equal(reuseResponse.body.error.code, 'REFRESH_TOKEN_REUSED');
});

test('refresh returns the same personal information user shape', async () => {
  const personalInfo = { firstName: 'Refresh', lastName: 'User', phone: '+66845678901', dateOfBirth: '1996-04-20' };
  const registration = await registerUser('refresh-personal-info', personalInfo);
  const response = await api
    .post('/api/v1/auth/refresh')
    .set('Cookie', cookieHeader(cookiesFrom(registration)));

  assert.equal(response.status, 200);
  assertPersonalProfile(response.body.data.user, { ...personalInfo, avatarUrl: null });
});

test('rejects registration without a first name', async () => {
  const response = await api.post('/api/v1/auth/register').send(userPayload('missing-first-name', { firstName: '' }));

  assert.equal(response.status, 422);
  assert.ok(response.body.error.fields.firstName);
});

test('rejects registration without a last name', async () => {
  const response = await api.post('/api/v1/auth/register').send(userPayload('missing-last-name', { lastName: '' }));

  assert.equal(response.status, 422);
  assert.ok(response.body.error.fields.lastName);
});

test('rejects registration without a phone number', async () => {
  const response = await api.post('/api/v1/auth/register').send(userPayload('missing-phone', { phone: '' }));

  assert.equal(response.status, 422);
  assert.ok(response.body.error.fields.phone);
});

test('rejects registration without a date of birth', async () => {
  const { dateOfBirth, ...payload } = userPayload('missing-date-of-birth');
  const response = await api.post('/api/v1/auth/register').send(payload);

  assert.equal(response.status, 422);
  assert.ok(response.body.error.fields.dateOfBirth);
});

test('rejects an invalid date of birth during registration', async () => {
  const response = await api.post('/api/v1/auth/register').send(userPayload('invalid-date-of-birth', { dateOfBirth: '2024-02-30' }));

  assert.equal(response.status, 422);
  assert.ok(response.body.error.fields.dateOfBirth);
});

test('rejects a future date of birth during registration', async () => {
  const response = await api.post('/api/v1/auth/register').send(userPayload('future-date-of-birth', { dateOfBirth: '2999-01-01' }));

  assert.equal(response.status, 422);
  assert.ok(response.body.error.fields.dateOfBirth);
});

test('rejects first name longer than 100 characters during registration', async () => {
  const response = await api.post('/api/v1/auth/register').send(userPayload('first-name-too-long', { firstName: 'a'.repeat(101) }));

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  assert.ok(response.body.error.fields.firstName);
});

test('rejects last name longer than 100 characters during registration', async () => {
  const response = await api.post('/api/v1/auth/register').send(userPayload('last-name-too-long', { lastName: 'a'.repeat(101) }));

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  assert.ok(response.body.error.fields.lastName);
});

test('rejects an invalid phone number during registration', async () => {
  const response = await api.post('/api/v1/auth/register').send(userPayload('invalid-phone', { phone: 'not-a-phone' }));

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  assert.ok(response.body.error.fields.phone);
});

test('rejects refresh without a refresh cookie', async () => {
  const response = await api.post('/api/v1/auth/refresh');

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'MISSING_REFRESH_TOKEN');
});

test('logs out with a valid access cookie and CSRF token', async () => {
  const agent = request.agent(app);
  const registration = await agent.post('/api/v1/auth/register').send(userPayload('logout-success'));
  const csrfToken = cookieValue(cookiesFrom(registration), 'gm_csrf');
  const logoutResponse = await agent
    .post('/api/v1/auth/logout')
    .set('X-CSRF-Token', csrfToken);
  const meResponse = await agent.get('/api/v1/auth/me');

  assert.equal(logoutResponse.status, 204);
  assert.equal(meResponse.status, 401);
});

test('rejects logout with an invalid CSRF token', async () => {
  const registration = await registerUser('logout-invalid-csrf');
  const response = await api
    .post('/api/v1/auth/logout')
    .set('Cookie', cookieHeader(cookiesFrom(registration)))
    .set('X-CSRF-Token', 'invalid-csrf-token');

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'CSRF_INVALID');
});

test('rejects logout without a CSRF token', async () => {
  const registration = await registerUser('logout-missing-csrf');
  const response = await api
    .post('/api/v1/auth/logout')
    .set('Cookie', cookieHeader(cookiesFrom(registration)));

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'CSRF_INVALID');
});

test('enforces the login rate limit for an isolated test IP address', async () => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await api
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', rateLimitIp)
      .send({ emailOrUsername: 'ab', password: 'x' });
    assert.equal(response.status, 422);
  }

  const blockedResponse = await api
    .post('/api/v1/auth/login')
    .set('X-Forwarded-For', rateLimitIp)
    .send({ emailOrUsername: 'ab', password: 'x' });

  assert.equal(blockedResponse.status, 429);
  assert.equal(blockedResponse.body.error.code, 'RATE_LIMITED');
});

// ===================== FORGOT PASSWORD =====================

test('forgot-password returns 200 for a registered email (email delivery suppressed in tests)', async () => {
  await registerUser('forgot-registered');
  const response = await api
    .post('/api/v1/auth/forgot-password')
    .send({ email: userPayload('forgot-registered').email });

  // Always 200 regardless of whether the account exists — no account disclosure.
  assert.equal(response.status, 200);
});

test('forgot-password returns 200 for an unknown email (no account disclosure)', async () => {
  const response = await api
    .post('/api/v1/auth/forgot-password')
    .send({ email: `${emailPrefix}unknown-does-not-exist@example.test` });

  assert.equal(response.status, 200);
});

test('forgot-password rejects an invalid email format', async () => {
  const response = await api
    .post('/api/v1/auth/forgot-password')
    .send({ email: 'not-an-email' });

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

// ===================== RESET PASSWORD =====================

test('rejects reset-password with an invalid token', async () => {
  const response = await api
    .post('/api/v1/auth/reset-password')
    .set('X-Forwarded-For', '203.0.113.11')
    .send({ token: 'a'.repeat(32), newPassword: 'NewPassword123' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_RESET_TOKEN');
});

test('rejects reset-password with a password that fails requirements', async () => {
  const response = await api
    .post('/api/v1/auth/reset-password')
    .set('X-Forwarded-For', '203.0.113.12')
    .send({ token: 'a'.repeat(32), newPassword: 'weakpassword' });

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('rejects reset-password when the token is too short', async () => {
  const response = await api
    .post('/api/v1/auth/reset-password')
    .set('X-Forwarded-For', '203.0.113.13')
    .send({ token: 'short', newPassword: 'NewPassword123' });

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});
