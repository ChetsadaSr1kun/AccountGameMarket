const { pool } = require('../config/database');

async function findOrCreateConversation(buyerId, sellerId, productId = null) {
  buyerId = Number(buyerId);
  sellerId = Number(sellerId);
  const [rows] = await pool.execute('SELECT id,buyer_id,seller_id,product_id,created_at,updated_at FROM conversations WHERE buyer_id=? AND seller_id=? AND product_id <=> ? LIMIT 1',[buyerId,sellerId,productId]);
  if (rows[0]) return rows[0];
  const [result] = await pool.execute('INSERT INTO conversations (buyer_id,seller_id,product_id) VALUES (?,?,?)',[buyerId,sellerId,productId]);
  const [created] = await pool.execute('SELECT id,buyer_id,seller_id,product_id,created_at,updated_at FROM conversations WHERE id=?',[result.insertId]);
  return created[0];
}

async function listForUser(userId) {
  const [rows] = await pool.execute(`SELECT c.id,c.product_id,c.updated_at,p.title product_title,u.id other_user_id,u.username other_username,u.avatar_url other_avatar,
    (SELECT m.body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) last_message,
    (SELECT m.created_at FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) last_message_at
    FROM conversations c LEFT JOIN products p ON p.id=c.product_id
    JOIN users u ON u.id=CASE WHEN c.buyer_id=? THEN c.seller_id ELSE c.buyer_id END
    WHERE c.buyer_id=? OR c.seller_id=? ORDER BY COALESCE(last_message_at,c.updated_at) DESC,c.id DESC`,[userId,userId,userId]);
  return rows;
}

async function getForUser(conversationId,userId) {
  const [rows] = await pool.execute(`SELECT c.id,c.buyer_id,c.seller_id,c.product_id,p.title product_title,
    bu.username buyer_username,su.username seller_username
    FROM conversations c LEFT JOIN products p ON p.id=c.product_id
    JOIN users bu ON bu.id=c.buyer_id JOIN users su ON su.id=c.seller_id
    WHERE c.id=? AND (c.buyer_id=? OR c.seller_id=?) LIMIT 1`,[conversationId,userId,userId]);
  return rows[0] || null;
}

async function listMessages(conversationId, limit=100) {
  const [rows] = await pool.execute(`SELECT m.id,m.sender_id,u.username sender_username,u.avatar_url sender_avatar,m.body,m.created_at
    FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=? ORDER BY m.created_at ASC,m.id ASC LIMIT ?`,[conversationId,limit]);
  return rows;
}

async function createMessage(conversationId,senderId,body) {
  const [result] = await pool.execute('INSERT INTO messages (conversation_id,sender_id,body) VALUES (?,?,?)',[conversationId,senderId,body]);
  await pool.execute('UPDATE conversations SET updated_at=UTC_TIMESTAMP(3) WHERE id=?',[conversationId]);
  const [rows] = await pool.execute(`SELECT m.id,m.sender_id,u.username sender_username,u.avatar_url sender_avatar,m.body,m.created_at FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?`,[result.insertId]);
  return rows[0];
}

async function listAdmin(limit=100) {
  const [rows] = await pool.execute(`SELECT m.id,m.conversation_id,m.sender_id,u.username sender_username,m.body,m.created_at,
    c.product_id,p.title product_title,bu.username buyer_username,su.username seller_username
    FROM messages m JOIN users u ON u.id=m.sender_id JOIN conversations c ON c.id=m.conversation_id
    JOIN users bu ON bu.id=c.buyer_id JOIN users su ON su.id=c.seller_id LEFT JOIN products p ON p.id=c.product_id
    ORDER BY m.created_at DESC,m.id DESC LIMIT ?`,[limit]);
  return rows;
}

module.exports={findOrCreateConversation,listForUser,getForUser,listMessages,createMessage,listAdmin};
