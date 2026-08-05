const config = require('../backend/src/config/env');
const { pool } = require('../backend/src/config/database');
const userRepository = require('../backend/src/repositories/user.repository');
const roleRepository = require('../backend/src/repositories/role.repository');
const { withTransaction } = require('../backend/src/utils/transaction');
const { hashPassword } = require('../backend/src/utils/password');

async function run() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !username || !password) {
    throw new Error('Set ADMIN_EMAIL, ADMIN_USERNAME, and ADMIN_PASSWORD in .env before creating an admin.');
  }
  if (!/^\S+@\S+\.\S+$/.test(email) || !/^[A-Za-z0-9_]{3,30}$/.test(username) || password.length < 8 || password.length > 72) {
    throw new Error('Admin credentials do not meet the required format.');
  }

  const passwordHash = await hashPassword(password);
  await withTransaction(async (connection) => {
    const existingEmail = await userRepository.findByEmail(email);
    const existingUsername = await userRepository.findByLogin(username);
    if (existingEmail || existingUsername) throw new Error('Admin email or username already exists.');

    const userId = await userRepository.create(connection, { email, username, passwordHash, accountMode: 'ADMIN' });
    const [adminRoleId] = await roleRepository.findIdsByCodes(connection, ['ADMIN']);
    if (!adminRoleId) throw new Error('ADMIN role is missing. Run the database migration first.');
    await userRepository.assignRoles(connection, userId, [adminRoleId]);
    console.log(`Admin user created with id ${userId}.`);
  });
}

run()
  .catch((error) => {
    console.error('Admin creation failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
