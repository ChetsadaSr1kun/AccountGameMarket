const service = require('../services/notification.service');
const asyncHandler = require('../utils/async-handler');
const { success } = require('../utils/response');

const list = asyncHandler(async (req,res) => success(res,200,{notifications:await service.list(req.user.id)}));
const count = asyncHandler(async (req,res) => success(res,200,{count:await service.count(req.user.id)}));
const markRead = asyncHandler(async (req,res) => success(res,200,{notification:await service.markRead(req.user.id,req.params.id)}));
const markAllRead = asyncHandler(async (req,res) => success(res,200,{updated:await service.markAllRead(req.user.id)}));

module.exports = { list, count, markRead, markAllRead };
