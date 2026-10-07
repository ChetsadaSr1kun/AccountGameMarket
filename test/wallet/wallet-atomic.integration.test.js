const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { pool } = require('../../backend/src/config/database');
const wallet = require('../../backend/src/repositories/wallet.repository');
const users = require('../../backend/src/repositories/user.repository');
const { withTransaction } = require('../../backend/src/utils/transaction');
const { prepareTestDatabase, cleanupTestUsers, closeTestDatabasePool } = require('../helpers/test-database');
const prefix = `walletatomic_${crypto.randomUUID().replaceAll('-', '')}`;
let userId;

before(async () => {
  await prepareTestDatabase();
  userId = await users.create(pool, { email: `${prefix}@example.test`, username: prefix.slice(0, 30),
    firstName: 'Wallet', lastName: 'Fixture', phone: null, dateOfBirth: '2000-01-01',
    passwordHash: 'test-only', accountMode: 'CUSTOMER_ONLY' });
});
after(async () => { await cleanupTestUsers(prefix); await closeTestDatabasePool(); });

test('decimal credits stay exact and concurrent debits cannot overspend', async () => {
  await withTransaction(async (connection) => {
    await wallet.creditBalance(userId, '0.10', connection);
    assert.equal(await wallet.creditBalance(userId, '0.20', connection), '0.30');
  });
  const results = await Promise.all([1, 2].map(() => withTransaction((connection) =>
    wallet.reserveBalance(userId, '0.20', connection))));
  assert.deepEqual(results.sort(), [false, true]);
  const [[row]] = await pool.execute('SELECT wallet_balance FROM users WHERE id=?', [userId]);
  assert.equal(row.wallet_balance, '0.10');
});

test('failed wallet operations roll back exact decimal balances', async () => {
  await assert.rejects(withTransaction(async (connection) => {
    await wallet.creditBalance(userId, '999.99', connection);
    throw new Error('rollback fixture');
  }), /rollback fixture/);
  const [[row]] = await pool.execute('SELECT wallet_balance FROM users WHERE id=?', [userId]);
  assert.equal(row.wallet_balance, '0.10');
});
