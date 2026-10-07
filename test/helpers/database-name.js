const name = process.env.GAMEMARKET_TEST_DB || 'gamemarket_db21_test';
if (!/^gamemarket_db21_test(?:_[a-z0-9_]+)?$/.test(name) || name.length > 64) {
  throw new Error('Only an isolated gamemarket_db21_test database is allowed.');
}
module.exports = name;
