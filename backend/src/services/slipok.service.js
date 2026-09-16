'use strict';

const config = require('../config/env');

const API_BASE_URL = 'https://api.slipok.com/api/line/apikey';
const REQUEST_TIMEOUT_MS = 15000;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jfif',
]);

function assertConfigured() {
  if (!config.slipOk.apiKey) {
    throw new Error('SLIPOK_API_KEY is not configured.');
  }
  if (!config.slipOk.branchId) {
    throw new Error('SLIPOK_BRANCH_ID is not configured.');
  }
}

function normalizeAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Invalid SlipOK verification amount.');
  }
  return Number(value.toFixed(2));
}

function toErrorMessage(body) {
  if (body && typeof body.message === 'string' && body.message.trim()) {
    return body.message.trim();
  }
  return 'SlipOK API request failed.';
}

async function checkSlip({ file, amount }) {
  assertConfigured();

  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new Error('Slip image is required.');
  }

  if (!ALLOWED_MIME_TYPES.has(String(file.mimetype || '').toLowerCase())) {
    throw new Error('Unsupported slip image type.');
  }

  const expectedAmount = normalizeAmount(amount);
  const form = new FormData();
  const blob = new Blob([file.buffer], {
    type: file.mimetype,
  });

  form.append('files', blob, file.originalname || 'slip');
  form.append('log', 'true');
  form.append('amount', String(expectedAmount));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${API_BASE_URL}/${encodeURIComponent(config.slipOk.branchId)}`,
      {
        method: 'POST',
        headers: {
          'x-authorization': config.slipOk.apiKey,
        },
        body: form,
        signal: controller.signal,
      },
    );

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(toErrorMessage(body));
      error.statusCode = response.status;
      error.providerCode = body?.code || null;
      throw error;
    }

    if (body?.success !== true || body?.data?.success !== true) {
      const error = new Error(toErrorMessage(body?.data || body));
      error.statusCode = 422;
      error.providerCode = body?.code || null;
      error.providerData = body?.data || null;
      throw error;
    }

    const data = body.data;
    const returnedAmount = normalizeAmount(data.amount);

    return {
      success: true,
      amount: returnedAmount,
      transRef: data.transRef || null,
      transTimestamp: data.transTimestamp || null,
      transDate: data.transDate || null,
      transTime: data.transTime || null,
      receivingBank: data.receivingBank || null,
      sendingBank: data.sendingBank || null,
      receiver: data.receiver || null,
      sender: data.sender || null,
      providerData: data,
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('SlipOK API request timed out.');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  checkSlip,
  ALLOWED_MIME_TYPES,
};
