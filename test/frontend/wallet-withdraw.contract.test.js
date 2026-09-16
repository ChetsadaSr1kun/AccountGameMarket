const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../assets/js/wallet-withdraw.js'),
  'utf8',
);

test('legacy withdrawal request keeps the CSRF contract required by its route', () => {
  const functionSource = source.slice(
    source.indexOf('async function createWithdrawalRequest()'),
    source.indexOf('async function startWithdrawalOtpFlow()'),
  );

  assert.match(functionSource, /const csrfToken = getWithdrawalCsrfToken\(\);/);
  assert.match(functionSource, /'X-CSRF-Token': csrfToken/);
});
