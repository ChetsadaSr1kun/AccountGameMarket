const path = require('path');
const dotenv = require('dotenv');

const testDatabaseName = 'gamemarket_test';

dotenv.config({
  path: path.resolve(process.cwd(), '.env.test'),
  quiet: true,
});

if (process.env.DB_NAME && process.env.DB_NAME !== testDatabaseName) {
  throw new Error('Automated tests may run only with DB_NAME=gamemarket_test.');
}

process.env.NODE_ENV = 'test';
process.env.DB_NAME = testDatabaseName;
process.env.EMAIL_ENABLED = 'false';
process.env.SMS_MODE = 'disabled';
