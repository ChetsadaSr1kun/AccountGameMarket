'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../../backend/src/config/env');
const slipOkService = require('../../backend/src/services/slipok.service');

test('SlipOK service validates configuration and sends a multipart slip check', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = config.slipOk.apiKey;
  const originalBranchId = config.slipOk.branchId;
  let captured = null;

  try {
    config.slipOk.apiKey = 'test-key';
    config.slipOk.branchId = '76182';
    global.fetch = async (url, options) => {
      captured = { url, options };
      return new Response(JSON.stringify({
        success: true,
        data: {
          success: true,
          message: '✅',
          amount: 100,
          transRef: 'REF-123',
          transTimestamp: '2026-09-16T00:00:00.000Z',
          receivingBank: '006',
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const result = await slipOkService.checkSlip({
      file: {
        buffer: Buffer.from('fake-image'),
        mimetype: 'image/png',
        originalname: 'slip.png',
      },
      amount: 100,
    });

    assert.equal(result.success, true);
    assert.equal(result.amount, 100);
    assert.equal(result.transRef, 'REF-123');
    assert.equal(captured.url, 'https://api.slipok.com/api/line/apikey/76182');
    assert.equal(captured.options.method, 'POST');
    assert.equal(captured.options.headers['x-authorization'], 'test-key');
    assert.ok(captured.options.body instanceof FormData);
  } finally {
    global.fetch = originalFetch;
    config.slipOk.apiKey = originalApiKey;
    config.slipOk.branchId = originalBranchId;
  }
});

test('SlipOK service rejects an invalid image type before calling the API', async () => {
  const originalFetch = global.fetch;
  let called = false;

  try {
    global.fetch = async () => {
      called = true;
      throw new Error('fetch should not be called');
    };

    await assert.rejects(
      slipOkService.checkSlip({
        file: {
          buffer: Buffer.from('fake'),
          mimetype: 'application/pdf',
          originalname: 'slip.pdf',
        },
        amount: 100,
      }),
      /Unsupported slip image type/,
    );

    assert.equal(called, false);
  } finally {
    global.fetch = originalFetch;
  }
});
