const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../assets/js/wallet-withdraw.js'),
  'utf8',
);

test('withdrawal UI uses the OTP attempt flow instead of the removed direct endpoint', () => {
  assert.match(source, /\/api\/v1\/wallet\/withdrawal-attempts/);
  assert.doesNotMatch(source, /\/api\/v1\/wallet\/withdrawals["'`]/);
});
