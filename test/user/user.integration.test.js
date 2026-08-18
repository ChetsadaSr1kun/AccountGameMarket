const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const request = require("supertest");

if (process.env.NODE_ENV !== "test" || process.env.DB_NAME !== "gamemarket_test") {
  throw new Error("Run user tests with npm test so the test database safety guard is active.");
}

const app = require("../../backend/src/app");
const { cleanupTestUsers, closeTestDatabasePool, prepareTestDatabase } = require("../helpers/test-database");

const api = request(app);
const runId = crypto.randomUUID().replaceAll("-", "");
const emailPrefix = `usertest_${runId}_`;

function userPayload(label, overrides = {}) {
  const labelId = crypto.createHash("sha256").update(label).digest("hex").slice(0, 8);
  return {
    email: `${emailPrefix}${label}@example.test`,
    username: `ut_${runId.slice(0, 12)}_${labelId}`,
    password: "TestPassword123",
    accountType: "CUSTOMER",
    ...overrides,
  };
}

function cookiesFrom(response) { return response.headers["set-cookie"] || []; }
function cookieHeader(cookies) { return cookies.map((v) => v.split(";", 1)[0]).join("; "); }

async function registerAndLogin(label, overrides) {
  const payload = userPayload(label, overrides);
  const reg = await api.post("/api/v1/auth/register").send(payload);
  assert.equal(reg.status, 201);
  return { cookies: cookiesFrom(reg), csrfToken: reg.body.data.csrfToken, payload };
}

before(async () => { await prepareTestDatabase(); await cleanupTestUsers(emailPrefix); });
after(async () => { await cleanupTestUsers(emailPrefix); await closeTestDatabasePool(); });

// ===================== UPDATE USERNAME =====================

test("updates username successfully", async () => {
  const { cookies, csrfToken } = await registerAndLogin("un-change");
  const newUsername = `ut_${runId.slice(0, 8)}_newname`;
  const r = await api.patch("/api/v1/user/username").set("Cookie", cookieHeader(cookies)).set("X-CSRF-Token", csrfToken).send({ newUsername });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.user.username, newUsername);
});

test("rejects username update when new username equals current", async () => {
  const { cookies, csrfToken, payload } = await registerAndLogin("un-same");
  const r = await api.patch("/api/v1/user/username").set("Cookie", cookieHeader(cookies)).set("X-CSRF-Token", csrfToken).send({ newUsername: payload.username });
  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, "VALIDATION_ERROR");
});

test("rejects duplicate username", async () => {
  const { cookies: c1, csrfToken } = await registerAndLogin("un-orig");
  const { payload: p2 } = await registerAndLogin("un-taken");
  const r = await api.patch("/api/v1/user/username").set("Cookie", cookieHeader(c1)).set("X-CSRF-Token", csrfToken).send({ newUsername: p2.username });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "DUPLICATE_USERNAME");
});

test("rejects invalid username format", async () => {
  const { cookies, csrfToken } = await registerAndLogin("un-invalid");
  const r = await api.patch("/api/v1/user/username").set("Cookie", cookieHeader(cookies)).set("X-CSRF-Token", csrfToken).send({ newUsername: "invalid username!" });
  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, "VALIDATION_ERROR");
});

test("rejects username update with missing CSRF token", async () => {
  const { cookies } = await registerAndLogin("un-nocsrf");
  const r = await api.patch("/api/v1/user/username").set("Cookie", cookieHeader(cookies)).send({ newUsername: "somevalidname" });
  assert.equal(r.status, 403);
  assert.equal(r.body.error.code, "CSRF_INVALID");
});

test("rejects username update when unauthenticated", async () => {
  const r = await api.patch("/api/v1/user/username").set("X-CSRF-Token", "any").send({ newUsername: "somevalidname" });
  assert.equal(r.status, 401);
  assert.equal(r.body.error.code, "UNAUTHENTICATED");
});

// ===================== UPDATE EMAIL =====================

test("updates email successfully", async () => {
  const { cookies, csrfToken } = await registerAndLogin("em-change");
  const newEmail = `${emailPrefix}em-changed-new@example.test`;
  const r = await api.patch("/api/v1/user/email").set("Cookie", cookieHeader(cookies)).set("X-CSRF-Token", csrfToken).send({ newEmail });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.user.email, newEmail);
});

test("rejects email update when new email equals current", async () => {
  const { cookies, csrfToken, payload } = await registerAndLogin("em-same");
  const r = await api.patch("/api/v1/user/email").set("Cookie", cookieHeader(cookies)).set("X-CSRF-Token", csrfToken).send({ newEmail: payload.email });
  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, "VALIDATION_ERROR");
});

test("rejects duplicate email", async () => {
  const { cookies: c1, csrfToken } = await registerAndLogin("em-orig");
  const { payload: p2 } = await registerAndLogin("em-taken");
  const r = await api.patch("/api/v1/user/email").set("Cookie", cookieHeader(c1)).set("X-CSRF-Token", csrfToken).send({ newEmail: p2.email });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "DUPLICATE_EMAIL");
});

test("rejects invalid email format", async () => {
  const { cookies, csrfToken } = await registerAndLogin("em-invalid");
  const r = await api.patch("/api/v1/user/email").set("Cookie", cookieHeader(cookies)).set("X-CSRF-Token", csrfToken).send({ newEmail: "not-an-email" });
  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, "VALIDATION_ERROR");
});

test("rejects email update with missing CSRF token", async () => {
  const { cookies } = await registerAndLogin("em-nocsrf");
  const r = await api.patch("/api/v1/user/email").set("Cookie", cookieHeader(cookies)).send({ newEmail: `${emailPrefix}em-nocsrf-new@example.test` });
  assert.equal(r.status, 403);
  assert.equal(r.body.error.code, "CSRF_INVALID");
});

test("rejects email update when unauthenticated", async () => {
  const r = await api.patch("/api/v1/user/email").set("X-CSRF-Token", "any").send({ newEmail: `${emailPrefix}em-unauth@example.test` });
  assert.equal(r.status, 401);
  assert.equal(r.body.error.code, "UNAUTHENTICATED");
});
