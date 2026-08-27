const service=require('../services/admin-dashboard.service');
const asyncHandler=require('../utils/async-handler');
const {success}=require('../utils/response');
const getSummary=asyncHandler(async(req,res)=>success(res,200,{summary:await service.getSummary()}));
module.exports={getSummary};
