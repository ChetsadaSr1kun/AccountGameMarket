const crypto = require('crypto');

function getKey() {
  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('CREDENTIAL_ENCRYPTION_KEY is required.');
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(value) {
  if (value === undefined || value === null || value === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

function decrypt(value) {
  if (!value) return null;
  const [ivText, tagText, encryptedText] = String(value).split('.');
  if (!ivText || !tagText || !encryptedText) throw new Error('Invalid encrypted credential.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivText, 'base64'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64')), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };