const { pool } = require('../config/database');

async function findReviewByOrderAndBuyer(orderId, buyerId, executor = pool) {
  const [rows] = await executor.execute('SELECT * FROM reviews WHERE order_id=? AND buyer_id=? LIMIT 1',[orderId,buyerId]);
  return rows[0] || null;
}
async function findCompletedOrderForBuyer(orderId,buyerId,executor=pool){
  const [rows]=await executor.execute(`SELECT id,product_id,buyer_id,seller_id,status FROM orders WHERE id=? AND buyer_id=? AND status='COMPLETED' LIMIT 1`,[orderId,buyerId]);
  return rows[0]||null;
}
async function create(data,executor=pool){const [result]=await executor.execute(`INSERT INTO reviews (order_id,product_id,buyer_id,seller_id,rating,comment) VALUES (?,?,?,?,?,?)`,[data.orderId,data.productId,data.buyerId,data.sellerId,data.rating,data.comment||null]);return findById(result.insertId,executor);}
async function findById(id,executor=pool){const [rows]=await executor.execute(`SELECT id,order_id,product_id,buyer_id,seller_id,rating,comment,seller_reply,seller_reply_at,status,created_at,updated_at FROM reviews WHERE id=? LIMIT 1`,[id]);return rows[0]||null;}
async function listByProduct(productId,limit=50,executor=pool){const [rows]=await executor.execute(`SELECT r.id,r.order_id,r.product_id,r.buyer_id,r.seller_id,r.rating,r.comment,r.seller_reply,r.seller_reply_at,r.status,r.created_at,u.username buyer_username FROM reviews r INNER JOIN users u ON u.id=r.buyer_id WHERE r.product_id=? AND r.status='ACTIVE' ORDER BY r.created_at DESC LIMIT ?`,[productId,limit]);return rows;}
async function listBySeller(sellerId,limit=50,executor=pool){const [rows]=await executor.execute(`SELECT r.id,r.order_id,r.product_id,r.buyer_id,r.seller_id,r.rating,r.comment,r.seller_reply,r.seller_reply_at,r.status,r.created_at,u.username buyer_username FROM reviews r INNER JOIN users u ON u.id=r.buyer_id WHERE r.seller_id=? AND r.status='ACTIVE' ORDER BY r.created_at DESC LIMIT ?`,[sellerId,limit]);return rows;}
async function getSellerSummary(sellerId,executor=pool){const [rows]=await executor.execute(`SELECT COUNT(*) review_count,COALESCE(AVG(rating),0) average_rating FROM reviews WHERE seller_id=? AND status='ACTIVE'`,[sellerId]);return {reviewCount:Number(rows[0]?.review_count||0),averageRating:Number(rows[0]?.average_rating||0)};}
module.exports={findReviewByOrderAndBuyer,findCompletedOrderForBuyer,create,findById,listByProduct,listBySeller,getSellerSummary};
