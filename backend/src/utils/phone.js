'use strict';

/** Converts allowed presentation separators to the digits-only stored value. */
function normalizeThaiPhone(value) {
  return typeof value === 'string' ? value.replace(/[\s-]/g, '') : value;
}

module.exports = { normalizeThaiPhone };
