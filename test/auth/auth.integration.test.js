const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');

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

async function registerUser(label, overrides) {
  const response = await api.post('/api/v1/auth/register').send(userPayload(label, overrides));
  assert.equal(response.status, 201);
  return response;
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
  assert.ok(cookieValue(cookiesFrom(response), 'gm_access'));
  assert.ok(cookieValue(cookiesFrom(response), 'gm_refresh'));
  assert.ok(cookieValue(cookiesFrom(response), 'gm_csrf'));
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
