'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const phone = require('../../assets/js/phone-format');

test('formats ten typed Thai phone digits as xxx-xxx-xxxx', () => {
  assert.equal(phone.formatThaiPhone('0812345678'), '081-234-5678');
});

test('formats a pasted ten-digit Thai phone number and strips non-digit input', () => {
  assert.equal(phone.formatThaiPhone('0812345678'), '081-234-5678');
  assert.equal(phone.formatThaiPhone('081a234b5678'), '081-234-5678');
});

test('limits a client phone value to ten digits and returns the canonical request value', () => {
  assert.equal(phone.formatThaiPhone('08123456789'), '081-234-5678');
  assert.equal(phone.digitsOnly('081-234-5678'), '0812345678');
});

test('formats canonical and legacy-formatted profile phone values safely', () => {
  assert.equal(phone.formatThaiPhoneForDisplay('0812345678'), '081-234-5678');
  assert.equal(phone.formatThaiPhoneForDisplay('081-234 5678'), '081-234-5678');
  assert.equal(phone.formatThaiPhoneForDisplay('+66812345678'), '+66812345678');
});
