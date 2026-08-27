const service = require('../services/wallet-topup.service');
const { success } = require('../utils/response');

async function createMyRequest(req, res, next) {
  try {
    const request = await service.createRequest(req.user.id, req.body.paymentMethod, req.body.amount);
    return success(res, 201, { request });
  } catch (error) {
    return next(error);
  }
}

async function listMyRequests(req, res, next) {
  try {
    const requests = await service.listMyRequests(req.user.id);
    return success(res, 200, { requests });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createMyRequest, listMyRequests };