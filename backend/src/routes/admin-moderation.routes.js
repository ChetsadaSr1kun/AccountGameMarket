const express=require('express');
const controller=require('../controllers/admin-moderation.controller');
const {authenticate,authorize}=require('../middleware/auth.middleware');
const {requireCsrf}=require('../middleware/csrf.middleware');
const router=express.Router();
router.get('/suspended',authenticate,authorize('ADMIN'),controller.list);
router.patch('/users/:userId/status',authenticate,authorize('ADMIN'),requireCsrf,controller.setStatus);
module.exports=router;
