const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const request = require("supertest");
const { pool } = require("../../backend/src/config/database");
const userRepository = require("../../backend/src/repositories/user.repository");
const emailService = require("../../backend/src/services/email.service");
const smsService = require("../../backend/src/services/sms.service");

if (process.env.NODE_ENV !== "test" || process.env.DB_NAME !== "gamemarket_test") {
  throw new Error("Run user tests with npm test so the test database safety guard is active.");
}

const app = require("../../backend/src/app");
const { cleanupTestUsers, closeTestDatabasePool, prepareTestDatabase } = require("../helpers/test-database");

const api = request(app);
const runId = crypto.randomUUID().replaceAll("-", "");
const emailPrefix = `usertest_${runId}_`;
const avatarDirectory = path.resolve(__dirname, "../../uploads/avatars");
const capturedVerificationOtps = new Map();
const originalSendEmailVerificationOtp = emailService.sendEmailVerificationOtp;
const capturedPhoneOtps = new Map();
const originalSendPhoneVerificationOtp = smsService.sendPhoneVerificationOtp;

function userPayload(label, overrides = {}) {
  const labelId = crypto.createHash("sha256").update(label).digest("hex").slice(0, 8);
  return {
    email: `${emailPrefix}${label}@example.test`,
    username: `ut_${runId.slice(0, 12)}_${labelId}`,
    password: "TestPassword123",
    firstName: "Test",
    lastName: "User",
    phone: "0812345678",
    dateOfBirth: "2000-01-01",
    accountType: "CUSTOMER",
    ...overrides,
  };
}

function cookiesFrom(response) { return response.headers["set-cookie"] || []; }
function cookieHeader(cookies) { return cookies.map((v) => v.split(";", 1)[0]).join("; "); }
function avatarPath(avatarUrl) { return path.join(avatarDirectory, path.basename(avatarUrl)); }
function jpegBuffer() { return Buffer.from([0xff, 0xd8, 0xff, 0xd9]); }

async function registerAndLogin(label, overrides) {
  const payload = userPayload(label, overrides);
  const reg = await api.post("/api/v1/auth/register").send(payload);
  assert.equal(reg.status, 201);
  return { cookies: cookiesFrom(reg), csrfToken: reg.body.data.csrfToken, payload };
}

async function uploadAvatar(cookies, csrfToken, buffer = jpegBuffer(), options = {}) {
  let requestBuilder = api.post("/api/v1/user/avatar");
  if (cookies) requestBuilder = requestBuilder.set("Cookie", cookieHeader(cookies));
  if (csrfToken) requestBuilder = requestBuilder.set("X-CSRF-Token", csrfToken);
  return requestBuilder.attach("avatar", buffer, {
    filename: options.filename || "avatar.jpg",
    contentType: options.contentType || "image/jpeg",
  });
}

async function sendEmailOtp(cookies, csrfToken) {
  return api.post('/api/v1/user/verification/email/send')
    .set('Cookie', cookieHeader(cookies))
    .set('X-CSRF-Token', csrfToken)
    .send({});
}

async function verifyEmailOtp(cookies, csrfToken, otp) {
  return api.post('/api/v1/user/verification/email/verify')
    .set('Cookie', cookieHeader(cookies))
    .set('X-CSRF-Token', csrfToken)
    .send({ otp });
}

async function sendPhoneOtp(cookies, csrfToken) {
  return api.post('/api/v1/user/verification/phone/send')
    .set('Cookie', cookieHeader(cookies))
    .set('X-CSRF-Token', csrfToken)
    .send({});
}

async function verifyPhoneOtp(cookies, csrfToken, otp) {
  return api.post('/api/v1/user/verification/phone/verify')
    .set('Cookie', cookieHeader(cookies))
    .set('X-CSRF-Token', csrfToken)
    .send({ otp });
}

function latestCapturedOtp(email) {
  const codes = capturedVerificationOtps.get(email) || [];
  return codes.at(-1);
}

function latestCapturedPhoneOtp(phone) {
  const codes = capturedPhoneOtps.get(phone) || [];
  return codes.at(-1);
}

async function agePhoneOtp(email) {
  await pool.execute(
    `UPDATE user_verification_otps
     INNER JOIN users ON users.id = user_verification_otps.user_id
       SET user_verification_otps.created_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 61 SECOND)
     WHERE users.email = ? AND channel = 'PHONE' AND used_at IS NULL AND invalidated_at IS NULL`,
    [email],
  );
}

async function ageEmailOtp(email) {
  await pool.execute(
    `UPDATE user_verification_otps
     INNER JOIN users ON users.id = user_verification_otps.user_id
       SET user_verification_otps.created_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 61 SECOND)
     WHERE users.email = ? AND channel = 'EMAIL' AND used_at IS NULL AND invalidated_at IS NULL`,
    [email],
  );
}

before(async () => {
  await prepareTestDatabase();
  await cleanupTestUsers(emailPrefix);
  emailService.sendEmailVerificationOtp = async ({ email, otp }) => {
    const codes = capturedVerificationOtps.get(email) || [];
    codes.push(otp);
    capturedVerificationOtps.set(email, codes);
  };
  smsService.sendPhoneVerificationOtp = async ({ phone, otp }) => {
    const codes = capturedPhoneOtps.get(phone) || [];
    codes.push(otp);
    capturedPhoneOtps.set(phone, codes);
  };
});
after(async () => {
  emailService.sendEmailVerificationOtp = originalSendEmailVerificationOtp;
  smsService.sendPhoneVerificationOtp = originalSendPhoneVerificationOtp;
  await cleanupTestUsers(emailPrefix);
  await closeTestDatabasePool();
});

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

// ===================== UPDATE PHONE =====================

test('updates a phone number as canonical digits and clears PHONE verification plus pending OTPs', async () => {
  const registration = await registerAndLogin('phone-change-pending');
  assert.equal((await sendPhoneOtp(registration.cookies, registration.csrfToken)).status, 204);
  const oldOtp = latestCapturedPhoneOtp(registration.payload.phone);
  const response = await api.patch('/api/v1/user/phone')
    .set('Cookie', cookieHeader(registration.cookies))
    .set('X-CSRF-Token', registration.csrfToken)
    .send({ newPhone: '082-345-6789' });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.user.phone, '0823456789');
  assert.equal(response.body.data.user.phoneVerified, false);
  const oldOtpResponse = await verifyPhoneOtp(registration.cookies, registration.csrfToken, oldOtp);
  assert.equal(oldOtpResponse.status, 422);
  assert.equal(oldOtpResponse.body.error.code, 'OTP_INVALID_OR_EXPIRED');
});

test('requires authentication, CSRF, and a valid changed phone number', async () => {
  const unauthenticated = await api.patch('/api/v1/user/phone').set('X-CSRF-Token', 'any').send({ newPhone: '0823456789' });
  assert.equal(unauthenticated.status, 401);

  const registration = await registerAndLogin('phone-change-invalid');
  const missingCsrf = await api.patch('/api/v1/user/phone')
    .set('Cookie', cookieHeader(registration.cookies))
    .send({ newPhone: '0823456789' });
  assert.equal(missingCsrf.status, 403);

  const invalid = await api.patch('/api/v1/user/phone')
    .set('Cookie', cookieHeader(registration.cookies))
    .set('X-CSRF-Token', registration.csrfToken)
    .send({ newPhone: 'not-a-phone' });
  assert.equal(invalid.status, 422);
});

// ===================== AVATAR UPLOAD =====================

test("uploads an avatar and returns the updated safe user", async () => {
  const { cookies, csrfToken } = await registerAndLogin("avatar-success");
  const response = await uploadAvatar(cookies, csrfToken);

  assert.equal(response.status, 200);
  assert.match(response.body.data.user.avatarUrl, /^\/uploads\/avatars\/avatar-[a-f0-9-]{36}\.jpg$/);
  await fs.access(avatarPath(response.body.data.user.avatarUrl));

  const staticResponse = await api.get(response.body.data.user.avatarUrl);
  assert.equal(staticResponse.status, 200);
});

test("rejects an avatar with an invalid content signature", async () => {
  const { cookies, csrfToken } = await registerAndLogin("avatar-invalid-type");
  const response = await uploadAvatar(cookies, csrfToken, Buffer.from("not-an-image"));

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, "INVALID_AVATAR_FILE_TYPE");
});

test("rejects an avatar larger than 2 MiB", async () => {
  const { cookies, csrfToken } = await registerAndLogin("avatar-too-large");
  const response = await uploadAvatar(cookies, csrfToken, Buffer.alloc((2 * 1024 * 1024) + 1));

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, "AVATAR_FILE_TOO_LARGE");
});

test("rejects avatar upload when unauthenticated", async () => {
  const response = await uploadAvatar(null, null);

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, "UNAUTHENTICATED");
});

test("rejects avatar upload without a CSRF token", async () => {
  const { cookies } = await registerAndLogin("avatar-no-csrf");
  const response = await uploadAvatar(cookies, null);

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, "CSRF_INVALID");
});

test("replaces an avatar only after the new avatar has been stored", async () => {
  const { cookies, csrfToken } = await registerAndLogin("avatar-replace");
  const firstResponse = await uploadAvatar(cookies, csrfToken);
  const firstAvatarUrl = firstResponse.body.data.user.avatarUrl;
  const secondResponse = await uploadAvatar(cookies, csrfToken, Buffer.from([0xff, 0xd8, 0xff, 0x00, 0xd9]));
  const secondAvatarUrl = secondResponse.body.data.user.avatarUrl;

  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 200);
  assert.notEqual(secondAvatarUrl, firstAvatarUrl);
  await fs.access(avatarPath(secondAvatarUrl));
  await assert.rejects(fs.access(avatarPath(firstAvatarUrl)), { code: "ENOENT" });
});

test("preserves the previous avatar and removes the new file when database update fails", async () => {
  const { cookies, csrfToken, payload } = await registerAndLogin("avatar-rollback");
  const initialResponse = await uploadAvatar(cookies, csrfToken);
  const initialAvatarUrl = initialResponse.body.data.user.avatarUrl;
  const filenamesBeforeFailure = new Set(await fs.readdir(avatarDirectory));
  const originalUpdateAvatarUrl = userRepository.updateAvatarUrl;
  userRepository.updateAvatarUrl = async () => { throw new Error("forced avatar database failure"); };

  let failedResponse;
  try {
    failedResponse = await uploadAvatar(cookies, csrfToken, Buffer.from([0xff, 0xd8, 0xff, 0x01, 0xd9]));
  } finally {
    userRepository.updateAvatarUrl = originalUpdateAvatarUrl;
  }

  assert.equal(initialResponse.status, 200);
  assert.equal(failedResponse.status, 500);
  const [rows] = await pool.execute("SELECT avatar_url FROM users WHERE email = ?", [payload.email]);
  assert.equal(rows[0].avatar_url, initialAvatarUrl);
  assert.deepEqual(new Set(await fs.readdir(avatarDirectory)), filenamesBeforeFailure);
  await fs.access(avatarPath(initialAvatarUrl));
});

// ===================== EMAIL VERIFICATION =====================

test('sends a hashed email OTP without exposing it in the API response', async () => {
  const { cookies, csrfToken, payload } = await registerAndLogin('verify-send');
  const response = await sendEmailOtp(cookies, csrfToken);

  assert.equal(response.status, 204);
  assert.equal(response.text, '');
  assert.match(latestCapturedOtp(payload.email), /^\d{6}$/);
  const [rows] = await pool.execute(
    `SELECT otp_hash, expires_at, used_at, attempts FROM user_verification_otps
     INNER JOIN users ON users.id = user_verification_otps.user_id
     WHERE users.email = ? AND channel = 'EMAIL'`,
    [payload.email],
  );
  assert.equal(rows.length, 1);
  assert.match(rows[0].otp_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(rows[0].otp_hash, latestCapturedOtp(payload.email));
  assert.equal(rows[0].used_at, null);
  assert.equal(rows[0].attempts, 0);
});

test('rejects an invalid email OTP', async () => {
  const { cookies, csrfToken } = await registerAndLogin('verify-invalid');
  assert.equal((await sendEmailOtp(cookies, csrfToken)).status, 204);
  const response = await verifyEmailOtp(cookies, csrfToken, '000000');
  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'OTP_INVALID_OR_EXPIRED');
});

test('locks an email OTP after five invalid verification attempts', async () => {
  const { cookies, csrfToken } = await registerAndLogin('verify-max-attempts');
  assert.equal((await sendEmailOtp(cookies, csrfToken)).status, 204);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await verifyEmailOtp(cookies, csrfToken, '000000');
    assert.equal(response.status, 422);
  }
  const fifth = await verifyEmailOtp(cookies, csrfToken, '000000');
  assert.equal(fifth.status, 429);
  assert.equal(fifth.body.error.code, 'OTP_ATTEMPTS_EXCEEDED');
});

test('rejects an expired email OTP', async () => {
  const { cookies, csrfToken, payload } = await registerAndLogin('verify-expired');
  assert.equal((await sendEmailOtp(cookies, csrfToken)).status, 204);
  await pool.execute(
    `UPDATE user_verification_otps
     INNER JOIN users ON users.id = user_verification_otps.user_id
       SET expires_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 SECOND)
     WHERE users.email = ? AND channel = 'EMAIL'`,
    [payload.email],
  );
  const response = await verifyEmailOtp(cookies, csrfToken, latestCapturedOtp(payload.email));
  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'OTP_INVALID_OR_EXPIRED');
});

test('marks an email OTP as single-use', async () => {
  const { cookies, csrfToken, payload } = await registerAndLogin('verify-reuse');
  assert.equal((await sendEmailOtp(cookies, csrfToken)).status, 204);
  const otp = latestCapturedOtp(payload.email);
  assert.equal((await verifyEmailOtp(cookies, csrfToken, otp)).status, 200);
  const reuse = await verifyEmailOtp(cookies, csrfToken, otp);
  assert.equal(reuse.status, 422);
  assert.equal(reuse.body.error.code, 'OTP_INVALID_OR_EXPIRED');
});

test('invalidates the previous OTP when a new email OTP is sent', async () => {
  const { cookies, csrfToken, payload } = await registerAndLogin('verify-resend');
  assert.equal((await sendEmailOtp(cookies, csrfToken)).status, 204);
  const oldOtp = latestCapturedOtp(payload.email);
  await ageEmailOtp(payload.email);
  assert.equal((await sendEmailOtp(cookies, csrfToken)).status, 204);
  const newOtp = latestCapturedOtp(payload.email);
  assert.notEqual(newOtp, oldOtp);
  const oldResponse = await verifyEmailOtp(cookies, csrfToken, oldOtp);
  assert.equal(oldResponse.status, 422);
  assert.equal((await verifyEmailOtp(cookies, csrfToken, newOtp)).status, 200);
});

test('EMAIL resend observes a server-side cooldown with a retry-after value', async () => {
  const { cookies, csrfToken, payload } = await registerAndLogin('verify-resend-cooldown');
  assert.equal((await sendEmailOtp(cookies, csrfToken)).status, 204);
  const cooldown = await sendEmailOtp(cookies, csrfToken);
  assert.equal(cooldown.status, 429);
  assert.equal(cooldown.body.error.code, 'OTP_RESEND_COOLDOWN');
  assert.ok(cooldown.body.error.retryAfterSeconds >= 1);
  assert.ok(Number(cooldown.headers['retry-after']) >= 1);
  await ageEmailOtp(payload.email);
  assert.equal((await sendEmailOtp(cookies, csrfToken)).status, 204);
});

test('limits email OTP resend requests per authenticated user', async () => {
  const { cookies, csrfToken, payload } = await registerAndLogin('verify-send-limit');
  assert.equal((await sendEmailOtp(cookies, csrfToken)).status, 204);
  await ageEmailOtp(payload.email);
  assert.equal((await sendEmailOtp(cookies, csrfToken)).status, 204);
  await ageEmailOtp(payload.email);
  assert.equal((await sendEmailOtp(cookies, csrfToken)).status, 204);
  const limited = await sendEmailOtp(cookies, csrfToken);
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error.code, 'RATE_LIMITED');
});

test('limits email OTP verify requests per authenticated user', async () => {
  const { cookies, csrfToken } = await registerAndLogin('verify-attempt-limit');
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await verifyEmailOtp(cookies, csrfToken, '000000');
    assert.equal(response.status, 422);
  }
  const limited = await verifyEmailOtp(cookies, csrfToken, '000000');
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error.code, 'RATE_LIMITED');
});

test('returns verification state from verify and /auth/me while legacy NULL states remain unverified', async () => {
  const legacy = await registerAndLogin('verify-legacy-null');
  const legacyMe = await api.get('/api/v1/auth/me').set('Cookie', cookieHeader(legacy.cookies));
  assert.equal(legacyMe.status, 200);
  assert.deepEqual(
    { emailVerified: legacyMe.body.data.user.emailVerified, phoneVerified: legacyMe.body.data.user.phoneVerified, accountVerified: legacyMe.body.data.user.accountVerified },
    { emailVerified: false, phoneVerified: false, accountVerified: false },
  );

  const verified = await registerAndLogin('verify-success');
  assert.equal((await sendEmailOtp(verified.cookies, verified.csrfToken)).status, 204);
  const response = await verifyEmailOtp(verified.cookies, verified.csrfToken, latestCapturedOtp(verified.payload.email));
  assert.equal(response.status, 200);
  assert.deepEqual(
    { emailVerified: response.body.data.user.emailVerified, phoneVerified: response.body.data.user.phoneVerified, accountVerified: response.body.data.user.accountVerified },
    { emailVerified: true, phoneVerified: false, accountVerified: false },
  );
  const me = await api.get('/api/v1/auth/me').set('Cookie', cookieHeader(verified.cookies));
  assert.equal(me.status, 200);
  assert.equal(me.body.data.user.emailVerified, true);
  assert.equal(me.body.data.user.phoneVerified, false);
  assert.equal(me.body.data.user.accountVerified, false);
});

test('rejects changing an email after it has been verified', async () => {
  const verified = await registerAndLogin('verify-email-change');
  assert.equal((await sendEmailOtp(verified.cookies, verified.csrfToken)).status, 204);
  assert.equal((await verifyEmailOtp(verified.cookies, verified.csrfToken, latestCapturedOtp(verified.payload.email))).status, 200);
  const updatedEmail = `${emailPrefix}verify-email-change-new@example.test`;
  const response = await api.patch('/api/v1/user/email')
    .set('Cookie', cookieHeader(verified.cookies))
    .set('X-CSRF-Token', verified.csrfToken)
    .send({ newEmail: updatedEmail });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'EMAIL_ALREADY_VERIFIED');
});

test('invalidates a pending email OTP when the email address changes', async () => {
  const registration = await registerAndLogin('verify-email-change-pending');
  assert.equal((await sendEmailOtp(registration.cookies, registration.csrfToken)).status, 204);
  const oldOtp = latestCapturedOtp(registration.payload.email);
  const response = await api.patch('/api/v1/user/email')
    .set('Cookie', cookieHeader(registration.cookies))
    .set('X-CSRF-Token', registration.csrfToken)
    .send({ newEmail: `${emailPrefix}verify-email-change-pending-new@example.test` });
  assert.equal(response.status, 200);
  const verifyOldOtp = await verifyEmailOtp(registration.cookies, registration.csrfToken, oldOtp);
  assert.equal(verifyOldOtp.status, 422);
  assert.equal(verifyOldOtp.body.error.code, 'OTP_INVALID_OR_EXPIRED');
});

// ===================== PHONE VERIFICATION =====================

test('sends a hashed PHONE OTP without exposing it in the API response', async () => {
  const { cookies, csrfToken, payload } = await registerAndLogin('phone-send');
  const response = await sendPhoneOtp(cookies, csrfToken);

  assert.equal(response.status, 204);
  assert.equal(response.text, '');
  assert.match(latestCapturedPhoneOtp(payload.phone), /^\d{6}$/);
  const [rows] = await pool.execute(
    `SELECT otp_hash, expires_at, used_at, attempts FROM user_verification_otps
     INNER JOIN users ON users.id = user_verification_otps.user_id
     WHERE users.email = ? AND channel = 'PHONE'`,
    [payload.email],
  );
  assert.equal(rows.length, 1);
  assert.match(rows[0].otp_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(rows[0].otp_hash, latestCapturedPhoneOtp(payload.phone));
  assert.equal(rows[0].used_at, null);
  assert.equal(rows[0].attempts, 0);
});

test('rejects phone OTP send without authentication or a valid CSRF token', async () => {
  const unauthenticated = await api.post('/api/v1/user/verification/phone/send').set('X-CSRF-Token', 'any').send({});
  const { cookies } = await registerAndLogin('phone-no-csrf');
  const noCsrf = await api.post('/api/v1/user/verification/phone/send').set('Cookie', cookieHeader(cookies)).send({});

  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.body.error.code, 'UNAUTHENTICATED');
  assert.equal(noCsrf.status, 403);
  assert.equal(noCsrf.body.error.code, 'CSRF_INVALID');
});

test('rejects an invalid and an expired PHONE OTP', async () => {
  const invalid = await registerAndLogin('phone-invalid');
  assert.equal((await sendPhoneOtp(invalid.cookies, invalid.csrfToken)).status, 204);
  const invalidResponse = await verifyPhoneOtp(invalid.cookies, invalid.csrfToken, '000000');
  assert.equal(invalidResponse.status, 422);
  assert.equal(invalidResponse.body.error.code, 'OTP_INVALID_OR_EXPIRED');

  const expired = await registerAndLogin('phone-expired');
  assert.equal((await sendPhoneOtp(expired.cookies, expired.csrfToken)).status, 204);
  await pool.execute(
    `UPDATE user_verification_otps
     INNER JOIN users ON users.id = user_verification_otps.user_id
       SET expires_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 SECOND)
     WHERE users.email = ? AND channel = 'PHONE'`,
    [expired.payload.email],
  );
  const expiredResponse = await verifyPhoneOtp(expired.cookies, expired.csrfToken, latestCapturedPhoneOtp(expired.payload.phone));
  assert.equal(expiredResponse.status, 422);
  assert.equal(expiredResponse.body.error.code, 'OTP_INVALID_OR_EXPIRED');
});

test('PHONE OTP is single-use and locks after five invalid attempts', async () => {
  const reuse = await registerAndLogin('phone-reuse');
  assert.equal((await sendPhoneOtp(reuse.cookies, reuse.csrfToken)).status, 204);
  const otp = latestCapturedPhoneOtp(reuse.payload.phone);
  assert.equal((await verifyPhoneOtp(reuse.cookies, reuse.csrfToken, otp)).status, 200);
  const reused = await verifyPhoneOtp(reuse.cookies, reuse.csrfToken, otp);
  assert.equal(reused.status, 422);
  assert.equal(reused.body.error.code, 'OTP_INVALID_OR_EXPIRED');

  const attempts = await registerAndLogin('phone-max-attempts');
  assert.equal((await sendPhoneOtp(attempts.cookies, attempts.csrfToken)).status, 204);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    assert.equal((await verifyPhoneOtp(attempts.cookies, attempts.csrfToken, '000000')).status, 422);
  }
  const fifth = await verifyPhoneOtp(attempts.cookies, attempts.csrfToken, '000000');
  assert.equal(fifth.status, 429);
  assert.equal(fifth.body.error.code, 'OTP_ATTEMPTS_EXCEEDED');
});

test('PHONE resend observes cooldown and invalidates the previous OTP after cooldown', async () => {
  const { cookies, csrfToken, payload } = await registerAndLogin('phone-resend');
  assert.equal((await sendPhoneOtp(cookies, csrfToken)).status, 204);
  const oldOtp = latestCapturedPhoneOtp(payload.phone);
  const cooldown = await sendPhoneOtp(cookies, csrfToken);
  assert.equal(cooldown.status, 429);
  assert.equal(cooldown.body.error.code, 'OTP_RESEND_COOLDOWN');
  await agePhoneOtp(payload.email);
  assert.equal((await sendPhoneOtp(cookies, csrfToken)).status, 204);
  const newOtp = latestCapturedPhoneOtp(payload.phone);
  assert.notEqual(newOtp, oldOtp);
  assert.equal((await verifyPhoneOtp(cookies, csrfToken, oldOtp)).status, 422);
  assert.equal((await verifyPhoneOtp(cookies, csrfToken, newOtp)).status, 200);
});

test('enforces PHONE send and verify rate limits separately', async () => {
  const sendLimited = await registerAndLogin('phone-send-limit');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    assert.equal((await sendPhoneOtp(sendLimited.cookies, sendLimited.csrfToken)).status, 204);
    if (attempt < 2) await agePhoneOtp(sendLimited.payload.email);
  }
  const sendLimit = await sendPhoneOtp(sendLimited.cookies, sendLimited.csrfToken);
  assert.equal(sendLimit.status, 429);
  assert.equal(sendLimit.body.error.code, 'RATE_LIMITED');

  const verifyLimited = await registerAndLogin('phone-verify-limit');
  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.equal((await verifyPhoneOtp(verifyLimited.cookies, verifyLimited.csrfToken, '000000')).status, 422);
  }
  const verifyLimit = await verifyPhoneOtp(verifyLimited.cookies, verifyLimited.csrfToken, '000000');
  assert.equal(verifyLimit.status, 429);
  assert.equal(verifyLimit.body.error.code, 'RATE_LIMITED');
});

test('PHONE verification updates safe user state through /auth/me, login, and refresh', async () => {
  const registration = await registerAndLogin('phone-success-state');
  assert.equal((await sendPhoneOtp(registration.cookies, registration.csrfToken)).status, 204);
  const verified = await verifyPhoneOtp(registration.cookies, registration.csrfToken, latestCapturedPhoneOtp(registration.payload.phone));
  assert.equal(verified.status, 200);
  assert.deepEqual(
    { emailVerified: verified.body.data.user.emailVerified, phoneVerified: verified.body.data.user.phoneVerified, accountVerified: verified.body.data.user.accountVerified },
    { emailVerified: false, phoneVerified: true, accountVerified: false },
  );
  const me = await api.get('/api/v1/auth/me').set('Cookie', cookieHeader(registration.cookies));
  assert.equal(me.status, 200);
  assert.equal(me.body.data.user.phoneVerified, true);
  const login = await api.post('/api/v1/auth/login').send({ username: registration.payload.username, password: registration.payload.password });
  assert.equal(login.status, 200);
  assert.equal(login.body.data.user.phoneVerified, true);
  const refresh = await api.post('/api/v1/auth/refresh').set('Cookie', cookieHeader(cookiesFrom(login)));
  assert.equal(refresh.status, 200);
  assert.equal(refresh.body.data.user.phoneVerified, true);
});

test('rejects changing a phone number after it has been verified', async () => {
  const verified = await registerAndLogin('verify-phone-change');
  assert.equal((await sendPhoneOtp(verified.cookies, verified.csrfToken)).status, 204);
  assert.equal((await verifyPhoneOtp(verified.cookies, verified.csrfToken, latestCapturedPhoneOtp(verified.payload.phone))).status, 200);
  const response = await api.patch('/api/v1/user/phone')
    .set('Cookie', cookieHeader(verified.cookies))
    .set('X-CSRF-Token', verified.csrfToken)
    .send({ newPhone: '0823456789' });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'PHONE_ALREADY_VERIFIED');
});

test('account verification requires both email and PHONE verification while NULL timestamps stay false', async () => {
  const legacy = await registerAndLogin('phone-legacy-null');
  const legacyMe = await api.get('/api/v1/auth/me').set('Cookie', cookieHeader(legacy.cookies));
  assert.deepEqual(
    { emailVerified: legacyMe.body.data.user.emailVerified, phoneVerified: legacyMe.body.data.user.phoneVerified, accountVerified: legacyMe.body.data.user.accountVerified },
    { emailVerified: false, phoneVerified: false, accountVerified: false },
  );

  const emailOnly = await registerAndLogin('phone-email-only');
  assert.equal((await sendEmailOtp(emailOnly.cookies, emailOnly.csrfToken)).status, 204);
  const emailOnlyResponse = await verifyEmailOtp(emailOnly.cookies, emailOnly.csrfToken, latestCapturedOtp(emailOnly.payload.email));
  assert.deepEqual(
    { emailVerified: emailOnlyResponse.body.data.user.emailVerified, phoneVerified: emailOnlyResponse.body.data.user.phoneVerified, accountVerified: emailOnlyResponse.body.data.user.accountVerified },
    { emailVerified: true, phoneVerified: false, accountVerified: false },
  );

  const both = await registerAndLogin('phone-both');
  assert.equal((await sendEmailOtp(both.cookies, both.csrfToken)).status, 204);
  assert.equal((await verifyEmailOtp(both.cookies, both.csrfToken, latestCapturedOtp(both.payload.email))).status, 200);
  assert.equal((await sendPhoneOtp(both.cookies, both.csrfToken)).status, 204);
  const bothResponse = await verifyPhoneOtp(both.cookies, both.csrfToken, latestCapturedPhoneOtp(both.payload.phone));
  assert.deepEqual(
    { emailVerified: bothResponse.body.data.user.emailVerified, phoneVerified: bothResponse.body.data.user.phoneVerified, accountVerified: bothResponse.body.data.user.accountVerified },
    { emailVerified: true, phoneVerified: true, accountVerified: true },
  );
});

test('invalidates a PHONE OTP and retains verification state when SMS delivery fails', async () => {
  const registration = await registerAndLogin('phone-delivery-failure');
  const originalSender = smsService.sendPhoneVerificationOtp;
  smsService.sendPhoneVerificationOtp = async () => { throw new Error('forced SMS delivery failure'); };
  let response;
  try {
    response = await sendPhoneOtp(registration.cookies, registration.csrfToken);
  } finally {
    smsService.sendPhoneVerificationOtp = originalSender;
  }
  assert.equal(response.status, 503);
  assert.equal(response.body.error.code, 'SMS_DELIVERY_FAILED');
  const [otpRows] = await pool.execute(
    `SELECT used_at, invalidated_at FROM user_verification_otps
     INNER JOIN users ON users.id = user_verification_otps.user_id
     WHERE users.email = ? AND channel = 'PHONE'`,
    [registration.payload.email],
  );
  assert.equal(otpRows.length, 1);
  assert.notEqual(otpRows[0].invalidated_at, null);
  const [userRows] = await pool.execute('SELECT phone_verified_at FROM users WHERE email = ?', [registration.payload.email]);
  assert.equal(userRows[0].phone_verified_at, null);
});
