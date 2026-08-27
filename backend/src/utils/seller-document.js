const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const AppError = require('./app-error');

const signatures = {
  jpeg: Buffer.from([0xff, 0xd8, 0xff]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  webp: Buffer.from('WEBP'),
};

function detectImage(buffer) {
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(signatures.jpeg)) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buffer.length >= 8 && buffer.subarray(0, 4).equals(signatures.png)) return { ext: 'png', mime: 'image/png' };
  if (buffer.length >= 12 && buffer.subarray(8, 12).equals(signatures.webp)) return { ext: 'webp', mime: 'image/webp' };
  return null;
}

async function saveSellerDocument({ userId, type, file }) {
  const detected = detectImage(file.buffer);
  if (!detected || detected.mime !== file.mimetype) throw new AppError('Document content does not match its declared image type.', 422, 'INVALID_SELLER_DOCUMENT_CONTENT');
  const directory = path.join(process.cwd(), 'uploads', 'seller-verification', String(userId));
  await fs.mkdir(directory, { recursive: true });
  const filename = `${type.toLowerCase()}-${crypto.randomUUID()}.${detected.ext}`;
  const absolutePath = path.join(directory, filename);
  await fs.writeFile(absolutePath, file.buffer, { flag: 'wx' });
  return {
    storagePath: path.relative(process.cwd(), absolutePath).split(path.sep).join('/'),
    mimeType: detected.mime,
    fileSize: file.size,
    sha256: crypto.createHash('sha256').update(file.buffer).digest('hex'),
  };
}

module.exports = { saveSellerDocument };
