const service=require('../services/transaction-report.service');
const asyncHandler=require('../utils/async-handler');
const {success}=require('../utils/response');
const createReport=asyncHandler(async(req,res)=>success(res,201,{report:await service.createReport(req.user.id,req.body||{})}));
const listPendingReports=asyncHandler(async(req,res)=>success(res,200,{reports:await service.listPendingReports()}));
const listAdminReports=asyncHandler(async(req,res)=>success(res,200,{reports:await service.listAdminReports()}));
const getReportDetail=asyncHandler(async(req,res)=>success(res,200,{report:await service.getReportDetail(req.params.id)}));
const updateReport=asyncHandler(async(req,res)=>success(res,200,{report:await service.updateReport(req.user.id,req.params.id,req.body||{})}));
module.exports={createReport,listPendingReports,listAdminReports,getReportDetail,updateReport};
