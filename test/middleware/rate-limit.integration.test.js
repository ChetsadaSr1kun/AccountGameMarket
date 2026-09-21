const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');

const app = require('../../backend/src/app');
const {
  GLOBAL_LIMIT_MAX,
  resetGlobalLimitForTests,
} = require('../../backend/src/middleware/rate-limit.middleware');
const { prepareTestDatabase } = require('../helpers/test-database');

const api = request(app);

test.before(async () => {
  await resetGlobalLimitForTests();
});

test.after(async () => {
  await resetGlobalLimitForTests();
});

test('global API limiter retains its 300-request production threshold', async () => {
  assert.equal(GLOBAL_LIMIT_MAX, 300);

  for (let attempt = 0; attempt < GLOBAL_LIMIT_MAX; attempt += 1) {
    const response = await api.get('/api/health');
    assert.equal(response.status, 200);
  }

  const blocked = await api.get('/api/health');
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error.code, 'RATE_LIMITED');
});

test('test database setup clears accumulated global limiter state', async () => {
  await prepareTestDatabase();

  const response = await api.get('/api/health');
  assert.equal(response.status, 200);
});

test('global limiter reset is unavailable outside the test environment', async () => {
  const originalEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await assert.rejects(resetGlobalLimitForTests(), /only be reset in tests/);
  } finally {
    process.env.NODE_ENV = originalEnvironment;
  }
});
