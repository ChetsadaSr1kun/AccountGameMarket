'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const config = require('../config/env');

class DisabledSmsSender {
  async sendPhoneVerificationOtp() {
    throw new Error('SMS delivery is disabled.');
  }
}

class DevelopmentSmsSender {
  constructor(inboxDirectory, isProduction = config.isProduction) {
    if (isProduction) throw new Error('Development SMS delivery is not permitted in production.');
    this.inboxDirectory = inboxDirectory;
  }

  async sendPhoneVerificationOtp({ phone, otp }) {
    await fs.mkdir(this.inboxDirectory, { recursive: true, mode: 0o700 });
    const filename = `sms-${crypto.randomUUID()}.json`;
    const destination = path.join(this.inboxDirectory, filename);
    const message = JSON.stringify({ phone, otp, createdAt: new Date().toISOString() });
    await fs.writeFile(destination, message, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  }
}

class ProviderSmsSender {
  async sendPhoneVerificationOtp() {
    throw new Error('No SMS provider has been configured.');
  }
}

function createSmsSender(options = config.sms) {
  if (options.mode === 'development') return new DevelopmentSmsSender(options.developmentInboxDirectory, options.isProduction);
  if (options.mode === 'provider') return new ProviderSmsSender();
  return new DisabledSmsSender();
}

let sender = createSmsSender();

async function sendPhoneVerificationOtp(message) {
  return sender.sendPhoneVerificationOtp(message);
}

module.exports = {
  DisabledSmsSender,
  DevelopmentSmsSender,
  ProviderSmsSender,
  createSmsSender,
  sendPhoneVerificationOtp,
};
