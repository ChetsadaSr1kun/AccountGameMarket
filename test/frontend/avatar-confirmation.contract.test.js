'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const script = fs.readFileSync(path.join(root, 'assets/js/script.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function functionBody(name, nextName) {
  const start = script.indexOf(`function ${name}`);
  const end = script.indexOf(`function ${nextName}`, start);
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
  assert.match(script, /function startPhoneOtpCooldown\(\)/);
  assert.match(script, /60 \* 1000/);
  assert.match(verifyBody, /applyCurrentUser\(data\.data\?\.user \|\| currentUser\)/);
  assert.doesNotMatch(`${sendBody}${verifyBody}`, /(localStorage|sessionStorage)/);
});
