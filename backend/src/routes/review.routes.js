const express=require('express');
const controller=require('../controllers/review.controller');
const {authenticate}=require('../middleware/auth.middleware');
const {requireCsrf}=require('../middleware/csrf.middleware');

const router=express.Router();
router.get('/products/:productId',controller.listProductReviews);
router.get('/sellers/:sellerId',controller.listSellerReviews);
router.use(authenticate);
router.post('/',requireCsrf,controller.createReview);
router.patch('/:reviewId/reply',requireCsrf,controller.replyToReview);

module.exports=router;
