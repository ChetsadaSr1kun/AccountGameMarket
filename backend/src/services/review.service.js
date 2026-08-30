const AppError = require('../utils/app-error');
const reviewRepository = require('../repositories/review.repository');
const notificationService = require('./notification.service');

function mapReview(row){if(!row)return null;return {id:Number(row.id),orderId:Number(row.order_id),productId:Number(row.product_id),buyerId:Number(row.buyer_id),sellerId:Number(row.seller_id),rating:Number(row.rating),comment:row.comment||'',sellerReply:row.seller_reply||'',sellerReplyAt:row.seller_reply_at, buyerUsername:row.buyer_username||undefined,createdAt:row.created_at,updatedAt:row.updated_at};}

async function createReview(buyerId,data){
  const orderId=Number(data.orderId),rating=Number(data.rating),comment=String(data.comment||'').trim();
  if(!Number.isInteger(orderId)||orderId<=0)throw new AppError('A valid orderId is required.',400,'INVALID_ORDER_ID');
  if(!Number.isInteger(rating)||rating<1||rating>5)throw new AppError('Rating must be between 1 and 5.',400,'INVALID_RATING');
  if(comment.length>500)throw new AppError('Review comment must not exceed 500 characters.',400,'COMMENT_TOO_LONG');
  const order=await reviewRepository.findCompletedOrderForBuyer(orderId,buyerId);
  if(!order)throw new AppError('Only buyers of completed orders can submit reviews.',403,'ORDER_NOT_REVIEWABLE');
  if(await reviewRepository.findReviewByOrderAndBuyer(orderId,buyerId))throw new AppError('You have already reviewed this order.',409,'REVIEW_ALREADY_EXISTS');
  const review=mapReview(await reviewRepository.create({orderId,productId:Number(order.product_id),buyerId,sellerId:Number(order.seller_id),rating,comment}));
  try{await notificationService.create({userId:Number(order.seller_id),type:'NEW_REVIEW',title:'ได้รับรีวิวใหม่',message:`คุณได้รับรีวิว ${rating}/5 จากผู้ซื้อ`,referenceType:'REVIEW',referenceId:review.id});}catch(error){console.error('notification create failed after review:',error.message);}
  return review;
}

async function listProductReviews(productId){return (await reviewRepository.listByProduct(Number(productId),50)).map(mapReview);}
async function listSellerReviews(sellerId){return (await reviewRepository.listBySeller(Number(sellerId),50)).map(mapReview);}
async function getSellerSummary(sellerId){return reviewRepository.getSellerSummary(Number(sellerId));}

async function replyToReview(sellerId,reviewId,reply){
  const id=Number(reviewId),text=String(reply||'').trim();
  if(!Number.isInteger(id)||id<=0)throw new AppError('A valid reviewId is required.',400,'INVALID_REVIEW_ID');
  if(!text)throw new AppError('Reply cannot be empty.',400,'EMPTY_REPLY');
  if(text.length>500)throw new AppError('Seller reply must not exceed 500 characters.',400,'REPLY_TOO_LONG');
  const review=await reviewRepository.findById(id);
  if(!review)throw new AppError('Review not found.',404,'REVIEW_NOT_FOUND');
  if(Number(review.seller_id)!==Number(sellerId))throw new AppError('You can only reply to reviews for your own seller account.',403,'REVIEW_REPLY_FORBIDDEN');
  if(review.seller_reply)throw new AppError('This review already has a seller reply.',409,'REPLY_ALREADY_EXISTS');
  const updated=mapReview(await reviewRepository.setSellerReply(id,sellerId,text));
  try{await notificationService.create({userId:Number(review.buyer_id),type:'NEW_REVIEW',title:'ผู้ขายตอบกลับรีวิวของคุณ',message:'ผู้ขายตอบกลับรีวิวของคุณแล้ว',referenceType:'REVIEW',referenceId:updated.id});}catch(error){console.error('notification create failed after seller reply:',error.message);}
  return updated;
}

module.exports={createReview,listProductReviews,listSellerReviews,getSellerSummary,replyToReview};
