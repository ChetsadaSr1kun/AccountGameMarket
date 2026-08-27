const AppError = require('../utils/app-error');
const repository = require('../repositories/seller-profile.repository');
function mapReview(row){return {id:Number(row.id),rating:Number(row.rating),comment:row.comment||'',buyerUsername:row.buyer_username,sellerReply:row.seller_reply||null,sellerReplyAt:row.seller_reply_at||null,createdAt:row.created_at};}
async function getProfile(sellerId){
  const id=Number(sellerId); if(!Number.isInteger(id)||id<=0) throw new AppError('A valid sellerId is required.',400,'INVALID_SELLER_ID');
  const seller=await repository.findSeller(id); if(!seller) throw new AppError('Seller not found.',404,'SELLER_NOT_FOUND');
  if(!seller.is_seller) throw new AppError('This user is not a seller.',404,'SELLER_NOT_FOUND');
  const [rating,reviews,completedSales,activeProducts]=await Promise.all([repository.getReviewSummary(id),repository.listReviews(id,50),repository.countCompletedSales(id),repository.listActiveProducts(id,6)]);
  return {seller:{id:Number(seller.id),username:seller.username,avatarUrl:seller.avatar_url,createdAt:seller.created_at,accountVerified:Boolean(seller.account_verified)},rating,completedSales,reviews:reviews.map(mapReview),activeProducts};
}
module.exports={getProfile};
