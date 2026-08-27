const { pool } = require('../config/database');

async function findSeller(sellerId, executor = pool) {
  const [rows] = await executor.execute(`SELECT u.id,u.username,u.avatar_url,u.created_at,
    CASE WHEN EXISTS (SELECT 1 FROM user_roles ur INNER JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code='SELLER') THEN 1 ELSE 0 END is_seller,
    CASE WHEN u.email_verified_at IS NOT NULL AND u.phone_verified_at IS NOT NULL THEN 1 ELSE 0 END account_verified
    FROM users u WHERE u.id=? LIMIT 1`, [sellerId]);
  return rows[0] || null;
}

async function getReviewSummary(sellerId, executor = pool) {
  const [rows] = await executor.execute(`SELECT COUNT(*) review_count, COALESCE(AVG(rating),0) average_rating,
    SUM(rating=5) rating_5,SUM(rating=4) rating_4,SUM(rating=3) rating_3,SUM(rating=2) rating_2,SUM(rating=1) rating_1
    FROM reviews WHERE seller_id=? AND status='ACTIVE'`, [sellerId]);
  const row=rows[0]||{};
  return {reviewCount:Number(row.review_count||0),averageRating:Number(row.average_rating||0),distribution:{5:Number(row.rating_5||0),4:Number(row.rating_4||0),3:Number(row.rating_3||0),2:Number(row.rating_2||0),1:Number(row.rating_1||0)}};
}

async function listReviews(sellerId, limit=50, executor = pool) {
  const [rows] = await executor.execute(`SELECT r.id,r.rating,r.comment,r.created_at,r.seller_reply,r.seller_reply_at,u.username buyer_username
    FROM reviews r INNER JOIN users u ON u.id=r.buyer_id WHERE r.seller_id=? AND r.status='ACTIVE' ORDER BY r.created_at DESC LIMIT ?`, [sellerId, limit]);
  return rows;
}

async function countCompletedSales(sellerId, executor = pool) {
  const [rows] = await executor.execute(`SELECT COUNT(*) completed_sales FROM orders WHERE seller_id=? AND status='COMPLETED'`, [sellerId]);
  return Number(rows[0]?.completed_sales||0);
}

async function listActiveProducts(sellerId, limit=6, executor = pool) {
  const [rows] = await executor.execute(`SELECT p.id,p.title,p.description,p.price,p.status,p.created_at,g.id game_id,g.name game_name
    FROM products p INNER JOIN games g ON g.id=p.game_id WHERE p.seller_id=? AND p.status IN ('ACTIVE','PUBLISHED')
    ORDER BY p.created_at DESC,p.id DESC LIMIT ?`, [sellerId,limit]);
  return rows.map(row=>({id:Number(row.id),title:row.title,description:row.description,price:Number(row.price),status:row.status,createdAt:row.created_at,game:{id:Number(row.game_id),name:row.game_name}}));
}

module.exports={findSeller,getReviewSummary,listReviews,countCompletedSales,listActiveProducts};
