'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const {
  DisabledSmsSender,
  DevelopmentSmsSender,
  ProviderSmsSender,
  createSmsSender,
} = require('../../backend/src/services/sms.service');

test('development SMS sender writes a local inbox message without an API response path', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gamemarket-sms-test-'));
  try {
    const sender = new DevelopmentSmsSender(directory, false);
    await sender.sendPhoneVerificationOtp({ phone: '0812345678', otp: '123456' });
    const files = await fs.readdir(directory);
    assert.equal(files.length, 1);
    const message = JSON.parse(await fs.readFile(path.join(directory, files[0]), 'utf8'));
    assert.deepEqual(message.phone, '0812345678');
    assert.deepEqual(message.otp, '123456');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('development SMS sender fails closed in production and placeholder senders cannot deliver SMS', async () => {
  assert.throws(() => new DevelopmentSmsSender('ignored', true), /not permitted in production/);
  await assert.rejects(new DisabledSmsSender().sendPhoneVerificationOtp({}), /disabled/);
  await assert.rejects(new ProviderSmsSender().sendPhoneVerificationOtp({}), /No SMS provider/);
  assert.ok(createSmsSender({ mode: 'disabled' }) instanceof DisabledSmsSender);
});
