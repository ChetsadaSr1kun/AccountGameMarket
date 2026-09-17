const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const { test } = require('node:test');

const ROOT = 'C:\\Project Final\\GameMarket';
const source = fs.readFileSync(`${ROOT}\\assets\\js\\seller-rating-ui.js`, 'utf8');
const index = fs.readFileSync(`${ROOT}\\index.html`, 'utf8');

function makeContext(user) {
  const card = { style: { display: 'none' } };
  const target = {
    innerHTML: '',
    closest: () => card,
  };
  let fetchCalls = 0;
  const context = {
    console: { error() {} },
    currentUser: user,
    window: {},
    document: { getElementById: () => target },
    fetch: async () => {
      fetchCalls += 1;
      return { ok: true, json: async () => ({ data: { rating: {}, reviews: [] } }) };
    },
  };
  vm.runInNewContext(source, context);
  return { context, card, target, getFetchCalls: () => fetchCalls };
}

 test('hides seller rating card and skips seller API for non-sellers', async () => {
  assert.match(index, /<div class="card" style="margin-bottom:16px;display:none">\s*<h4[^>]*>⭐ คะแนนผู้ขาย/);
  const { context, card, target, getFetchCalls } = makeContext({ id: 15, roles: ['BUYER'] });
  await context.window.loadProfileSellerRating();
  assert.equal(card.style.display, 'none');
  assert.equal(target.innerHTML, '');
  assert.equal(getFetchCalls(), 0);
});

test('shows seller rating card and loads seller API for sellers', async () => {
  const { context, card, target, getFetchCalls } = makeContext({ id: 15, roles: ['SELLER'] });
  await context.window.loadProfileSellerRating();
  assert.equal(card.style.display, '');
  assert.equal(getFetchCalls(), 1);
  assert.match(target.innerHTML, /seller-rating-empty/);
});
