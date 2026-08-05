const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../backend/src/config/env');

async function run() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name,
    multipleStatements: true,
    timezone: 'Z',
  });

  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const migrationDirectory = path.resolve(__dirname, '../database/migrations');
    const filenames = fs.readdirSync(migrationDirectory).filter((file) => file.endsWith('.sql')).sort();
    const [applied] = await connection.execute('SELECT filename FROM schema_migrations');
    const appliedNames = new Set(applied.map((row) => row.filename));

    for (const filename of filenames) {
      if (appliedNames.has(filename)) continue;
      const sql = fs.readFileSync(path.join(migrationDirectory, filename), 'utf8');
      await connection.query(sql);
      await connection.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [filename]);
      console.log(`Applied ${filename}`);
    }
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
});
