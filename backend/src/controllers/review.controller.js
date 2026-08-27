const reviewService=require('../services/review.service');
const asyncHandler=require('../utils/async-handler');
const {success}=require('../utils/response');

const createReview=asyncHandler(async(req,res)=>success(res,201,{review:await reviewService.createReview(req.user.id,req.body||{})}));

const listSellerReviews=asyncHandler(async(req,res)=>{
 const sellerId=Number(req.params.sellerId); if(!Number.isInteger(sellerId)||sellerId<=0)return res.status(400).json({error:{code:'INVALID_SELLER_ID',message:'A valid sellerId is required.'}});
 const [reviews,summary]=await Promise.all([reviewService.listSellerReviews(sellerId),reviewService.getSellerSummary(sellerId)]);
 return success(res,200,{reviews,summary});
});

const listProductReviews=asyncHandler(async(req,res)=>{
 const productId=Number(req.params.productId); if(!Number.isInteger(productId)||productId<=0)return res.status(400).json({error:{code:'INVALID_PRODUCT_ID',message:'A valid productId is required.'}});
 return success(res,200,{reviews:await reviewService.listProductReviews(productId)});
});

const replyToReview=asyncHandler(async(req,res)=>success(res,200,{review:await reviewService.replyToReview(req.user.id,req.params.reviewId,req.body?.reply)}));
module.exports={createReview,listProductReviews,listSellerReviews,replyToReview};
