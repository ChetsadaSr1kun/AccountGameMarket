'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const twilio = require('twilio');
const config = require('../config/env');

class DisabledSmsSender {
  async sendPhoneVerificationOtp() {
    throw new Error('SMS delivery is disabled.');
  }

  async checkPhoneVerificationOtp() {
    throw new Error('SMS verification is disabled.');
  }
}

class DevelopmentSmsSender {
  constructor(inboxDirectory, isProduction = config.isProduction) {
    if (isProduction) {
      throw new Error('Development SMS delivery is not permitted in production.');
    }

    this.inboxDirectory = inboxDirectory;
  }

  async sendPhoneVerificationOtp({ phone, otp }) {
    await fs.mkdir(this.inboxDirectory, { recursive: true, mode: 0o700 });

    const filename = `sms-${crypto.randomUUID()}.json`;
    const destination = path.join(this.inboxDirectory, filename);

    const message = JSON.stringify({
      phone,
      otp,
      createdAt: new Date().toISOString(),
    });

    await fs.writeFile(destination, message, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
  }

  async checkPhoneVerificationOtp() {
    return { status: 'approved' };
  }
}

class ProviderSmsSender {
  constructor(options = config.sms) {
    if (!options.twilioAccountSid) {
      throw new Error('TWILIO_ACCOUNT_SID is not configured.');
    }

    if (!options.twilioAuthToken) {
      throw new Error('TWILIO_AUTH_TOKEN is not configured.');
    }

    if (!options.twilioVerifyServiceSid) {
      throw new Error('TWILIO_VERIFY_SERVICE_SID is not configured.');
    }

    this.client = twilio(
      options.twilioAccountSid,
      options.twilioAuthToken,
      {
        timeout: 10000,
      }
    );

    this.serviceSid = options.twilioVerifyServiceSid;
  }

  async sendPhoneVerificationOtp({ phone }) {
    return this.client.verify.v2
      .services(this.serviceSid)
      .verifications.create({
        to: phone,
        channel: 'sms',
      });
  }

  async checkPhoneVerificationOtp({ phone, otp }) {
    return this.client.verify.v2
      .services(this.serviceSid)
      .verificationChecks.create({
        to: phone,
        code: otp,
      });
  }
}

function createSmsSender(options = config.sms) {
  if (options.mode === 'development') {
    return new DevelopmentSmsSender(
      options.developmentInboxDirectory,
      options.isProduction
    );
  }

  if (options.mode === 'provider') {
    return new ProviderSmsSender(options);
  }

  return new DisabledSmsSender();
}

let sender = createSmsSender();

async function sendPhoneVerificationOtp(message) {
  return sender.sendPhoneVerificationOtp(message);
}

async function checkPhoneVerificationOtp(message) {
  return sender.checkPhoneVerificationOtp(message);
}

module.exports = {
  DisabledSmsSender,
  DevelopmentSmsSender,
  ProviderSmsSender,
  createSmsSender,
  sendPhoneVerificationOtp,
  checkPhoneVerificationOtp,
};