const service = require('../services/seller-profile.service');
const asyncHandler = require('../utils/async-handler');
const { success } = require('../utils/response');

const getProfile = asyncHandler(async (req,res)=>{
  const profile=await service.getProfile(req.params.sellerId);
  return success(res,200,profile);
});

module.exports={getProfile};
