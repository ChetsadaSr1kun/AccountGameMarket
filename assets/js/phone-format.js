'use strict';

(function registerPhoneFormat(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GameMarketPhone = api;
}(typeof globalThis === 'undefined' ? null : globalThis, () => {
  function digitsOnly(value) {
    return String(value ?? '').replace(/\D/g, '').slice(0, 10);
  }

  function formatThaiPhone(value) {
    const digits = digitsOnly(value);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function formatThaiPhoneForDisplay(value) {
    if (value === null || value === undefined || value === '') return 'ยังไม่ได้ระบุ';
    const raw = String(value);
    const digits = raw.replace(/\D/g, '');
    return /^0\d{9}$/.test(digits) ? formatThaiPhone(digits) : raw;
  }

  return { digitsOnly, formatThaiPhone, formatThaiPhoneForDisplay };
}));
