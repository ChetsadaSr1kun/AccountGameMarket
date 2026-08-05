const config = require('../config/env');

async function sendPasswordResetEmail({ email, resetUrl }) {
  if (config.emailEnabled) {
    throw new Error('EMAIL_ENABLED is true, but an email provider has not been configured yet.');
  }

  if (!config.isProduction) {
    console.info(`[Development only] Password reset link for ${email}: ${resetUrl}`);
  }
}

module.exports = { sendPasswordResetEmail };
