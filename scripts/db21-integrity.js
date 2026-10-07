// Read-only comparison against a local, ignored baseline. Never prints row data.
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { pool } = require('../backend/src/config/database');

const baselinePath = 'tmp/db21/integrity-baseline.json';
const quote = (name) => `\`${name.replaceAll('`', '``')}\``;
const digest = (rows) => crypto.createHash('sha256')
  .update(JSON.stringify(rows.map((row) => JSON.stringify(row)).sort())).digest('hex');

async function snapshot(baseline) {
  const [tables] = await pool.query('SHOW TABLES');
  const result = {};
  const [[chatSchema]] = await pool.query(`SELECT COUNT(*) n FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='conversations' AND COLUMN_NAME='conversation_type'`);
  for (const table of baseline ? Object.keys(baseline) : tables.map((row) => Object.values(row)[0])) {
    if (table === 'schema_migrations') continue;
    let columns = baseline?.[table].columns;
    if (!columns) {
      const [fields] = await pool.query(`SHOW COLUMNS FROM ${quote(table)}`);
      columns = fields.map((field) => field.Field);
    }
    let sql = `SELECT ${columns.map(quote).join(',')} FROM ${quote(table)}`;
    if (baseline && ['review_reports', 'transaction_reports'].includes(table)
      && tables.some((row) => Object.values(row)[0] === 'reports')) {
      const type = table === 'review_reports' ? 'REVIEW' : 'TRANSACTION';
      sql = `SELECT ${columns.map((column) => column === 'id' ? 'COALESCE(source_report_id,id) id' : quote(column)).join(',')}
        FROM reports WHERE report_type='${type}'`;
    }
    if (baseline && chatSchema.n) {
      if (table === 'conversations') sql += " WHERE conversation_type='USER'";
      if (table === 'messages') sql += " WHERE conversation_id IN (SELECT id FROM conversations WHERE conversation_type='USER')";
      if (table === 'support_conversations') sql = `SELECT COALESCE(legacy_support_id,id) id,support_user_id user_id,
        assigned_admin_id,support_status status,user_last_read_message_id,admin_last_read_message_id,created_at,
        updated_at,closed_at FROM conversations WHERE conversation_type='SUPPORT'`;
      if (table === 'support_messages') sql = `SELECT COALESCE(m.legacy_support_id,m.id) id,
        COALESCE(c.legacy_support_id,c.id) conversation_id,m.sender_id,m.body,m.created_at
        FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.conversation_type='SUPPORT'`;
    }
    if (baseline && table === 'wallets') {
      const [[field]] = await pool.query(`SELECT COUNT(*) n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='wallet_balance'`);
      if (field.n) sql = `SELECT id user_id,wallet_balance balance,wallet_created_at created_at,
        wallet_updated_at updated_at FROM users WHERE wallet_created_at IS NOT NULL`;
    }
    if (baseline && table === 'user_roles') {
      const [[field]] = await pool.query(`SELECT COUNT(*) n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='admin_role_assigned_at'`);
      if (field.n) {
        sql = [['admin', 1], ['seller', 2], ['customer', 3]].map(([role, id]) =>
          `SELECT id user_id,${id} role_id,${role}_role_assigned_at assigned_at
           FROM users WHERE ${role}_role_assigned_at IS NOT NULL`).join(' UNION ALL ');
      }
    }
    if (baseline && table === 'roles' && !tables.some((row) => Object.values(row)[0] === 'roles')) {
      sql = "SELECT 1 id,'ADMIN' code,'Administrator' name UNION ALL SELECT 2,'SELLER','Seller' UNION ALL SELECT 3,'CUSTOMER','Customer'";
    }
    if (baseline && table === 'seller_verification_documents') {
      const [[field]] = await pool.query(`SELECT COUNT(*) n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='seller_verification_requests' AND COLUMN_NAME='id_front_id'`);
      if (field.n) {
        sql = ['ID_FRONT', 'ID_BACK', 'SELFIE'].map((type) => {
          const prefix = type.toLowerCase();
          return `SELECT ${prefix}_id id,id request_id,'${type}' document_type,
            ${prefix}_storage_path storage_path,${prefix}_mime_type mime_type,
            ${prefix}_file_size file_size,${prefix}_sha256 sha256,${prefix}_created_at created_at
            FROM seller_verification_requests WHERE ${prefix}_id IS NOT NULL`;
        }).join(' UNION ALL ');
      }
    }
    const [rows] = await pool.query(sql);
    result[table] = { columns, count: rows.length, digest: digest(rows) };
  }
  return result;
}

async function run() {
  try {
    if (process.argv[2] === 'capture') {
      const result = await snapshot();
      fs.mkdirSync('tmp/db21', { recursive: true });
      fs.writeFileSync(baselinePath, JSON.stringify(result, null, 2), { flag: 'wx' });
      console.log('Baseline saved: counts and SHA-256 only; no source rows or secrets.');
      console.log(Object.fromEntries(Object.entries(result).map(([name, value]) => [name, value.count])));
    } else if (process.argv[2] === 'verify') {
      const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
      const actual = await snapshot(baseline);
      for (const [table, expected] of Object.entries(baseline)) {
        assert.equal(actual[table].count, expected.count, `${table}: count changed; STOP`);
        assert.equal(actual[table].digest, expected.digest, `${table}: data changed; STOP`);
        console.log(`${table}: count and every original column match`);
      }
    } else {
      throw new Error('Usage: node scripts/db21-integrity.js capture|verify');
    }
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error.code || error.message);
  process.exitCode = 1;
});
