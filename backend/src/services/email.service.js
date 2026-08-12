const config = require('../config/env');

async function sendPasswordResetEmail() {
  if (config.emailEnabled) {
    throw new Error('EMAIL_ENABLED is true, but an email provider has not been configured yet.');
  }
}

module.exports = { sendPasswordResetEmail };
