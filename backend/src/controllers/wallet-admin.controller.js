const service = require('../services/wallet-admin.service');
const { success } = require('../utils/response');

async function listTopupHistory(req, res, next) {
  try {
    const [history, summary] = await Promise.all([
      service.listTopupHistory(),
      service.getTopupSummary(),
    ]);
    return success(res, 200, { history, summary });
  } catch (error) { return next(error); }
}

async function listPending(req, res, next) {
  try { return success(res, 200, { requests: await service.listPending() }); }
  catch (error) { return next(error); }
}

async function approve(req, res, next) {
  try { return success(res, 200, { request: await service.decide(Number(req.params.id), req.user.id, true) }); }
  catch (error) { return next(error); }
}

async function reject(req, res, next) {
  try { return success(res, 200, { request: await service.decide(Number(req.params.id), req.user.id, false, req.body.reason) }); }
  catch (error) { return next(error); }
}

async function listPendingWithdrawals(req, res, next) {
  try { return success(res, 200, { requests: await service.listPendingWithdrawals() }); }
  catch (error) { return next(error); }
}

async function approveWithdrawal(req, res, next) {
  try { return success(res, 200, { request: await service.decideWithdrawal(Number(req.params.id), req.user.id, true) }); }
  catch (error) { return next(error); }
}

async function rejectWithdrawal(req, res, next) {
  try { return success(res, 200, { request: await service.decideWithdrawal(Number(req.params.id), req.user.id, false, req.body.reason) }); }
  catch (error) { return next(error); }
}

module.exports = { listPending, listTopupHistory, approve, reject, listPendingWithdrawals, approveWithdrawal, rejectWithdrawal };