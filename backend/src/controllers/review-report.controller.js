const service = require('../services/review-report.service');
const asyncHandler = require('../utils/async-handler');
const { success } = require('../utils/response');

const createReport = asyncHandler(async (req,res)=>success(res,201,{report:await service.createReport(req.user.id,req.body||{})}));
const listPendingReports = asyncHandler(async (req,res)=>success(res,200,{reports:await service.listPendingReports()}));
const resolveReport = asyncHandler(async (req,res)=>success(res,200,{report:await service.resolveReport(req.user.id,req.params.reportId,req.body?.action,req.body?.adminNote)}));

module.exports={createReport,listPendingReports,resolveReport};
