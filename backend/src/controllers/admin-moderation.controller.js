const service=require('../services/admin-moderation.service');
const asyncHandler=require('../utils/async-handler');
const {success}=require('../utils/response');
const list=asyncHandler(async(req,res)=>success(res,200,{users:await service.listSuspended()}));
const setStatus=asyncHandler(async(req,res)=>success(res,200,{user:await service.setStatus(req.user.id,req.params.userId,req.body||{})}));
module.exports={list,setStatus};
