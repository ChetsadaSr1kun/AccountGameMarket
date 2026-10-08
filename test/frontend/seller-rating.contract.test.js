const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// The legacy seller-rating-ui.js was replaced by the current profile page.
const source = fs.readFileSync(path.resolve(__dirname, '../../assets/js/user-profile-ui.js'), 'utf8');

function makeContext(roles) {
  const target = {
    innerHTML: '',
    removeAttribute() {},
    insertAdjacentHTML(position, html) { this.innerHTML += html; },
  };
  const urls = [];
  const errors = [];
  const context = {
    console: { error(...args) { errors.push(args); } },
    currentUser: { id: 15, username: 'fixture', roles },
    window: {},
    document: { getElementById: () => target },
    fetch: async (url) => {
      urls.push(url);
      const data = url.includes('/sellers/')
        ? { rating: { averageRating: 4.5, reviewCount: 2 }, completedSales: 3, reviews: [], activeProducts: [] }
        : { orders: [], wallet: { transactions: [] } };
      return { ok: true, json: async () => ({ data }) };
    },
  };
  vm.runInNewContext(source, context);
  return { context, target, urls, errors };
}

test('customer profile skips the seller API and seller rating panel', async () => {
  const { context, target, urls, errors } = makeContext(['CUSTOMER']);
  await context.window.loadUserProfile();
  assert.equal(errors.length, 0);
  assert.deepEqual(urls, ['/api/v1/orders', '/api/v1/wallet']);
  assert.doesNotMatch(target.innerHTML, /คะแนนผู้ขาย/);
});

test('seller profile consumes the existing seller rating response', async () => {
  const { context, target, urls, errors } = makeContext(['CUSTOMER', 'SELLER']);
  await context.window.loadUserProfile();
  assert.equal(errors.length, 0);
  assert.deepEqual(urls, ['/api/v1/orders', '/api/v1/wallet', '/api/v1/sellers/15']);
  assert.match(target.innerHTML, /คะแนนผู้ขาย/);
  assert.match(target.innerHTML, /4\.5/);
});
