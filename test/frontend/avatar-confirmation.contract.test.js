'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const script = fs.readFileSync(path.join(root, 'assets/js/script.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function functionBody(name, nextName) {
  const start = script.indexOf(`function ${name}(`);
  const end = script.indexOf(`function ${nextName}(`, start);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must exist after ${name}`);
  return script.slice(start, end);
}

test('selecting an avatar creates a preview without calling the upload API', () => {
  const selectBody = functionBody('uploadAvatarFromProfile', 'clearPendingAvatarChange');
  assert.match(html, /onchange="uploadAvatarFromProfile\(\)"/);
  assert.match(selectBody, /URL\.createObjectURL/);
  assert.doesNotMatch(selectBody, /fetch\('\/api\/v1\/user\/avatar'/);
});

test('the profile avatar button opens a hidden file picker without rendering Choose File UI', () => {
  const openBody = functionBody('openProfileAvatarPicker', 'clearPendingAvatarChange');
  assert.match(html, /class="profile-avatar-trigger"[^>]*onclick="openProfileAvatarPicker\(\)"/);
  assert.match(openBody, /profileAvatarInput'\)\?\.click\(\)/);
  assert.match(html, /id="profileAvatarInput" class="visually-hidden"/);
  assert.doesNotMatch(html, /type="file" style="display:block/);
});

test('cancelling an avatar change clears the pending preview and restores the current user avatar', () => {
  const cancelBody = functionBody('cancelAvatarChangeFromProfile', 'confirmAvatarChangeFromProfile');
  assert.match(cancelBody, /clearPendingAvatarChange\(true\)/);
  assert.match(script, /URL\.revokeObjectURL/);
});

test('confirming an avatar change is the only client flow that posts the selected file', () => {
  const confirmBody = functionBody('confirmAvatarChangeFromProfile', 'sendEmailVerificationOtp');
  assert.match(confirmBody, /fetch\('\/api\/v1\/user\/avatar'/);
  assert.match(confirmBody, /pendingAvatarFile/);
  assert.match(html, /id="profileAvatarConfirmButton"/);
});

test('a successful avatar response is applied through the current-user source of truth and nav renderer', () => {
  const confirmBody = functionBody('confirmAvatarChangeFromProfile', 'sendEmailVerificationOtp');
  assert.match(confirmBody, /applyCurrentUser\(data\.data\?\.user \|\| currentUser\)/);
  assert.match(script, /function syncAvatarElements\(\)/);
  assert.match(script, /function updateNav\(\)/);
  assert.match(script, /avatarContent\(username, currentUser\?\.avatarUrl\)/);
});

test('profile provides readonly Phone OTP controls with CSRF-protected phone endpoints', () => {
  const sendBody = functionBody('sendPhoneVerificationOtp', 'verifyPhoneVerificationOtp');
  const verifyBody = functionBody('verifyPhoneVerificationOtp', 'changePasswordFromProfile');
  assert.match(html, /id="profilePhone"[^>]*readonly disabled/);
  assert.match(html, /id="profilePhoneVerificationSendButton"[^>]*onclick="sendPhoneVerificationOtp\(\)"/);
  assert.match(html, /id="profilePhoneVerificationOtp"[^>]*maxlength="6"/);
  assert.match(html, /id="profilePhoneVerificationVerifyButton"[^>]*onclick="verifyPhoneVerificationOtp\(\)"/);
  assert.match(sendBody, /fetch\('\/api\/v1\/user\/verification\/phone\/send'/);
  assert.match(verifyBody, /fetch\('\/api\/v1\/user\/verification\/phone\/verify'/);
  assert.doesNotMatch(sendBody, /JSON\.stringify/);
  assert.match(verifyBody, /JSON\.stringify\(\{ otp \}\)/);
});

test('Phone OTP UI keeps codes out of browser storage and applies successful verification user state', () => {
  const sendBody = functionBody('sendPhoneVerificationOtp', 'verifyPhoneVerificationOtp');
  const verifyBody = functionBody('verifyPhoneVerificationOtp', 'changePasswordFromProfile');
  assert.match(script, /const otpCooldowns = \{/);
  assert.match(script, /function startOtpCooldown\(channel, seconds = 60\)/);
  assert.match(script, /seconds \* 1000/);
  assert.match(verifyBody, /applyCurrentUser\(data\.data\?\.user \|\| currentUser\)/);
  assert.doesNotMatch(`${sendBody}${verifyBody}`, /(localStorage|sessionStorage)/);
});

test('verification cards show pending controls only while their channel is unverified', () => {
  assert.match(html, /data-verification-pending="email"/);
  assert.match(html, /data-verification-success="email"/);
  assert.match(html, /data-verification-pending="phone"/);
  assert.match(html, /data-verification-success="phone"/);
  assert.match(html, /data-verification-change="email"/);
  assert.match(html, /data-verification-change="phone"/);
  assert.match(script, /data-verification-change/);
  assert.match(script, /channelVerified \? 'none' : ''/);
  assert.match(script, /channelVerified \? '' : 'none'/);
});

test('email and phone OTP cooldowns are independent and only start after a successful send or server cooldown response', () => {
  const emailBody = functionBody('sendEmailVerificationOtp', 'verifyEmailVerificationOtp');
  const phoneBody = functionBody('sendPhoneVerificationOtp', 'verifyPhoneVerificationOtp');
  assert.match(emailBody, /startOtpCooldown\('email'\)/);
  assert.match(phoneBody, /startOtpCooldown\('phone'\)/);
  assert.match(emailBody, /OTP_RESEND_COOLDOWN/);
  assert.match(phoneBody, /OTP_RESEND_COOLDOWN/);
  assert.match(script, /otpCooldowns\[channel\]/);
  assert.doesNotMatch(`${emailBody}${phoneBody}`, /(localStorage|sessionStorage)/);
});

test('profile target change dialogs use authenticated CSRF-protected update endpoints and no OTP target payload', () => {
  const saveBody = functionBody('saveVerificationTarget', 'changePasswordFromProfile');
  assert.match(html, /id="changeEmailModal"/);
  assert.match(html, /id="changePhoneModal"/);
  assert.match(html, /onclick="openVerificationTargetModal\('email'\)"/);
  assert.match(html, /onclick="openVerificationTargetModal\('phone'\)"/);
  assert.match(saveBody, /fetch\(`\/api\/v1\/user\/\$\{isEmail \? 'email' : 'phone'\}`/);
  assert.match(saveBody, /'X-CSRF-Token': activeCsrfToken/);
  assert.match(saveBody, /newEmail: value/);
  assert.match(saveBody, /newPhone: value/);
  assert.match(saveBody, /clearOtpCooldown\(channel\)/);
});

test('login UI and request contract use username only and expose no Google login action', () => {
  const loginBody = functionBody('login', 'register');
  assert.match(html, /id="loginUsername"/);
  assert.doesNotMatch(html, /id="loginEmail"/);
  assert.doesNotMatch(html, /Google/);
  assert.match(loginBody, /JSON\.stringify\(\{\s*username,\s*password\s*\}\)/);
  assert.doesNotMatch(loginBody, /emailOrUsername/);
});
