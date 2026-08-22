const { pool } = require('../config/database');

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    dateOfBirth: row.date_of_birth,
    avatarUrl: row.avatar_url,
    emailVerifiedAt: row.email_verified_at,
    phoneVerifiedAt: row.phone_verified_at,
    passwordHash: row.password_hash,
    accountMode: row.account_mode,
    status: row.status,
    tokenVersion: row.token_version,
    roles: row.role_codes ? row.role_codes.split(',') : [],
    createdAt: row.created_at,
  };
}

const authSelect = `
  SELECT u.id, u.email, u.username, u.first_name, u.last_name, u.phone,
         u.date_of_birth, u.avatar_url, u.email_verified_at, u.phone_verified_at,
         u.password_hash, u.account_mode, u.status,
         u.token_version, u.created_at,
         GROUP_CONCAT(DISTINCT r.code ORDER BY r.id SEPARATOR ',') AS role_codes
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r ON r.id = ur.role_id
`;

async function findByLogin(login) {
  const [rows] = await pool.execute(`${authSelect} WHERE u.email = ? OR u.username = ? GROUP BY u.id LIMIT 1`, [login, login]);
  return mapUser(rows[0]);
}

async function findByEmail(email) {
  const [rows] = await pool.execute('SELECT id, email, username, account_mode, status, token_version FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

async function findAuthUserById(userId, executor = pool) {
  const [rows] = await executor.execute(`${authSelect} WHERE u.id = ? GROUP BY u.id LIMIT 1`, [userId]);
  return mapUser(rows[0]);
}

async function create(executor, { email, username, firstName, lastName, phone, dateOfBirth, passwordHash, accountMode }) {
  const [result] = await executor.execute(
    'INSERT INTO users (email, username, first_name, last_name, phone, date_of_birth, password_hash, account_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [email, username, firstName, lastName, phone, dateOfBirth, passwordHash, accountMode],
  );
  return result.insertId;
}

async function assignRoles(executor, userId, roleIds) {
  const values = roleIds.map(() => '(?, ?)').join(', ');
  const params = roleIds.flatMap((roleId) => [userId, roleId]);
  await executor.execute(`INSERT INTO user_roles (user_id, role_id) VALUES ${values}`, params);
}

async function updatePassword(executor, userId, passwordHash) {
  await executor.execute('UPDATE users SET password_hash = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?', [passwordHash, userId]);
}

async function incrementTokenVersion(executor, userId) {
  await executor.execute('UPDATE users SET token_version = token_version + 1, updated_at = UTC_TIMESTAMP(3) WHERE id = ?', [userId]);
}

async function findByUsername(username) {
  const [rows] = await pool.execute('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
  return rows[0] || null;
}

async function findAuthUserByUsername(username) {
  const [rows] = await pool.execute(`${authSelect} WHERE u.username = ? GROUP BY u.id LIMIT 1`, [username]);
  return mapUser(rows[0]);
}

async function updateUsername(executor, userId, username) {
  await executor.execute('UPDATE users SET username = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?', [username, userId]);
}

async function updateEmail(executor, userId, email) {
  await executor.execute('UPDATE users SET email = ?, email_verified_at = NULL, updated_at = UTC_TIMESTAMP(3) WHERE id = ?', [email, userId]);
}

async function updatePhone(executor, userId, phone) {
  await executor.execute('UPDATE users SET phone = ?, phone_verified_at = NULL, updated_at = UTC_TIMESTAMP(3) WHERE id = ?', [phone, userId]);
}

async function updateAvatarUrl(executor, userId, avatarUrl) {
  await executor.execute('UPDATE users SET avatar_url = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?', [avatarUrl, userId]);
}

async function markEmailVerified(executor, userId) {
  await executor.execute('UPDATE users SET email_verified_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3) WHERE id = ?', [userId]);
}

async function markPhoneVerified(executor, userId) {
  await executor.execute('UPDATE users SET phone_verified_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3) WHERE id = ?', [userId]);
}

module.exports = { findByLogin, findByEmail, findAuthUserById, findAuthUserByUsername, create, assignRoles, updatePassword, incrementTokenVersion, findByUsername, updateUsername, updateEmail, updatePhone, updateAvatarUrl, markEmailVerified, markPhoneVerified };
