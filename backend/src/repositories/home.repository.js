const { pool } = require('../config/database');

async function getStats(executor = pool) {
  const [[products]] = await executor.execute("SELECT COUNT(*) AS total FROM products WHERE status IN ('ACTIVE','PUBLISHED')");
  const [[users]] = await executor.execute("SELECT COUNT(*) AS total FROM users WHERE status <> 'DELETED'");
  const [[orders]] = await executor.execute("SELECT COUNT(*) AS total FROM orders WHERE status IN ('PAID','COMPLETED')");
  return {
    products: Number(products.total || 0),
    users: Number(users.total || 0),
    successfulPurchases: Number(orders.total || 0),
  };
}

module.exports = { getStats };
