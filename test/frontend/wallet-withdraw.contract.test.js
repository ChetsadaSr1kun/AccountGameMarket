const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const withdrawSource = fs.readFileSync(
  path.resolve(__dirname, '../../assets/js/wallet-withdraw.js'),
  'utf8',
);
const topupSource = fs.readFileSync(
  path.resolve(__dirname, '../../assets/js/wallet-topup-ui.js'),
  'utf8',
);
const indexSource = fs.readFileSync(
  path.resolve(__dirname, '../../index.html'),
  'utf8',
);
const adminTopupSource = fs.readFileSync(
  path.resolve(__dirname, '../../assets/js/admin-topup-ui.js'),
  'utf8',
);
const adminWithdrawSource = fs.readFileSync(
  path.resolve(__dirname, '../../assets/js/admin-withdraw-ui.js'),
  'utf8',
);

test('withdrawal UI uses the OTP attempt flow instead of the removed direct endpoint', () => {
  assert.match(withdrawSource, /\/api\/v1\/wallet\/withdrawal-attempts/);
  assert.doesNotMatch(withdrawSource, /\/api\/v1\/wallet\/withdrawals["'`]/);
});

test('new transaction UI exposes only BANK and PROMPTPAY', () => {
  assert.doesNotMatch(indexSource, /selectWalletPaymentMethod\(['"]TRUEMONEY/);
  assert.doesNotMatch(indexSource, /<option value=["']TRUEMONEY["']/);
  assert.match(topupSource, /new Set\(\[['"]BANK['"], ['"]PROMPTPAY['"]\]\)/);
  assert.match(withdrawSource, /\[['"]BANK['"], ['"]PROMPTPAY['"]\]\.includes\(paymentMethod\)/);
  assert.match(indexSource, /<option value="BANK">บัญชีธนาคาร<\/option><option value="PROMPTPAY">พร้อมเพย์<\/option>/);
  assert.match(indexSource, /data-withdraw-method="BANK"/);
  assert.match(indexSource, /data-withdraw-method="PROMPTPAY"/);
  assert.match(indexSource, /withdrawPaymentMethodOptionBank[\s\S]*>🏦<\/span><span>บัญชีธนาคาร<\/span>/);
  assert.match(indexSource, /withdrawPaymentMethodOptionPromptPay[\s\S]*src="assets\/images\/promptpay-circle\.png"[\s\S]*<span>พร้อมเพย์<\/span>/);
  assert.match(withdrawSource, /PROMPTPAY: \{ label: 'พร้อมเพย์', icon: 'assets\/images\/promptpay-circle\.png' \}/);
  assert.match(withdrawSource, /selectedIcon\.appendChild\(image\)/);
  assert.match(withdrawSource, /select\.value = method/);
  assert.match(withdrawSource, /document\.getElementById\('withdrawPaymentMethod'\)\?\.value/);
  assert.doesNotMatch(indexSource, /withdrawPromptPayIcon|withdrawBankIcon|withdrawPaymentMethodIcon/);
  assert.doesNotMatch(withdrawSource, /updateWithdrawalPaymentMethodIcon|withdrawPromptPayIcon|withdrawBankIcon/);
});

test('legacy TrueMoney labels remain available for history and admin rendering', () => {
  assert.match(topupSource, /TRUEMONEY: ['"]TrueMoney Wallet['"]/);
  assert.match(adminTopupSource, /TRUEMONEY:['"]💰 TrueMoney['"]/);
  assert.match(adminWithdrawSource, /TRUEMONEY:['"]💰 TrueMoney['"]/);
});
