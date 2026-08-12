const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../../backend/src/config/env');
const { pool } = require('../../backend/src/config/database');

const TEST_DATABASE_NAME = 'gamemarket_test';

function assertTestDatabase() {
  if (config.env !== 'test' || config.db.name !== TEST_DATABASE_NAME) {
    throw new Error('Authentication tests are locked to the gamemarket_test database.');
  }
}

function connectionOptions(database) {
  return {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    ...(database ? { database } : {}),
    multipleStatements: true,
    timezone: 'Z',
  };
}

async function prepareTestDatabase() {
  assertTestDatabase();

  const serverConnection = await mysql.createConnection(connectionOptions());
  try {
    await serverConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${TEST_DATABASE_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await serverConnection.end();
  }

  const databaseConnection = await mysql.createConnection(connectionOptions(TEST_DATABASE_NAME));
  try {
    await databaseConnection.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const migrationDirectory = path.resolve(__dirname, '../../database/migrations');
    const filenames = fs.readdirSync(migrationDirectory)
      .filter((filename) => filename.endsWith('.sql'))
      .sort();
    const [appliedRows] = await databaseConnection.execute('SELECT filename FROM schema_migrations');
    const applied = new Set(appliedRows.map((row) => row.filename));

    for (const filename of filenames) {
      if (applied.has(filename)) continue;
      const sql = fs.readFileSync(path.join(migrationDirectory, filename), 'utf8');
      await databaseConnection.query(sql);
      await databaseConnection.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [filename]);
    }
  } finally {
    await databaseConnection.end();
  }
}

async function cleanupTestUsers(emailPrefix) {
  assertTestDatabase();
  const emailPattern = `${emailPrefix}%`;

  await pool.execute(
    `DELETE refresh_tokens FROM refresh_tokens
     INNER JOIN users ON users.id = refresh_tokens.user_id
     WHERE users.email LIKE ?`,
    [emailPattern],
  );
  await pool.execute(
    `DELETE password_reset_tokens FROM password_reset_tokens
     INNER JOIN users ON users.id = password_reset_tokens.user_id
     WHERE users.email LIKE ?`,
    [emailPattern],
  );
  await pool.execute(
    `DELETE user_roles FROM user_roles
     INNER JOIN users ON users.id = user_roles.user_id
     WHERE users.email LIKE ?`,
    [emailPattern],
  );
  await pool.execute('DELETE FROM users WHERE email LIKE ?', [emailPattern]);
}

async function closeTestDatabasePool() {
  await pool.end();
}

module.exports = {
  TEST_DATABASE_NAME,
  assertTestDatabase,
  prepareTestDatabase,
  cleanupTestUsers,
  closeTestDatabasePool,
};
