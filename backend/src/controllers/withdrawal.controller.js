const withdrawalService = require('../services/withdrawal.service');
const asyncHandler = require('../utils/async-handler');
const { success } = require('../utils/response');

const createRequest = asyncHandler(async (req, res) => {
  const request = await withdrawalService.createRequest(req.user.id, req.body);
  return success(res, 201, { request });
});

const listMyRequests = asyncHandler(async (req, res) => {
  const requests = await withdrawalService.listMyRequests(req.user.id);
  return success(res, 200, { requests });
});

module.exports = { createRequest, listMyRequests };