const express=require('express');
const controller=require('../controllers/admin-dashboard.controller');
const {authenticate,authorize}=require('../middleware/auth.middleware');
const router=express.Router();
router.get('/',authenticate,authorize('ADMIN'),controller.getSummary);
module.exports=router;
