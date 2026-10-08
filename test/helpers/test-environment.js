const path = require('path');
const dotenv = require('dotenv');

const testDatabaseName = require('./database-name');

dotenv.config({
  path: path.resolve(process.cwd(), '.env.test'),
  quiet: true,
});

if (process.env.DB_NAME && !['gamemarket_test', testDatabaseName].includes(process.env.DB_NAME)) {
  throw new Error('Automated tests may run only with an isolated test database.');
}

process.env.NODE_ENV = 'test';
process.env.DB_NAME = testDatabaseName;
process.env.EMAIL_ENABLED = 'false';
process.env.SMS_MODE = 'disabled';
