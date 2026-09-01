const { pool } = require('../config/database');

async function getStats() {
  const [[products]] = await pool.execute("SELECT COUNT(*) total FROM products WHERE status IN ('ACTIVE','PUBLISHED')");
  const [[users]] = await pool.execute("SELECT COUNT(*) total FROM users WHERE status <> 'DELETED'");
  const [[sales]] = await pool.execute("SELECT COUNT(*) total FROM orders WHERE status IN ('PAID','COMPLETED')");
  return { products: Number(products.total), users: Number(users.total), successfulPurchases: Number(sales.total) };
}

async function getUserHome(userId) {
  const [[wallet]] = await pool.execute('SELECT COALESCE(balance,0) balance FROM wallets WHERE user_id=? LIMIT 1', [userId]);
  const [[purchases]] = await pool.execute("SELECT COUNT(*) total FROM orders WHERE buyer_id=? AND status IN ('PAID','COMPLETED')", [userId]);
  const [[listings]] = await pool.execute("SELECT COUNT(*) total FROM products WHERE seller_id=? AND status IN ('ACTIVE','PUBLISHED')", [userId]);
  const [messages] = await pool.execute('SELECT c.id,c.product_id,p.title product_title,u.username other_username,u.avatar_url other_avatar,(SELECT m.body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) last_message,(SELECT m.created_at FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) last_message_at FROM conversations c LEFT JOIN products p ON p.id=c.product_id JOIN users u ON u.id=CASE WHEN c.buyer_id=? THEN c.seller_id ELSE c.buyer_id END WHERE c.buyer_id=? OR c.seller_id=? ORDER BY COALESCE(last_message_at,c.updated_at) DESC,c.id DESC LIMIT 3', [userId,userId,userId]);
  return { wallet:Number(wallet?.balance||0), purchases:Number(purchases.total), listings:Number(listings.total), messages:messages.length, recentMessages:messages.map((m)=>({id:Number(m.id),otherUsername:m.other_username,otherAvatar:m.other_avatar,lastMessage:m.last_message||'ยังไม่มีข้อความ',lastMessageAt:m.last_message_at,productTitle:m.product_title||null})) };
}

module.exports = { getStats, getUserHome };
