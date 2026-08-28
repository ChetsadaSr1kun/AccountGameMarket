const service = require('../services/admin-user.service');
const asyncHandler = require('../utils/async-handler');
const { success } = require('../utils/response');

const list = asyncHandler(async (req, res) => success(res, 200, {
  users: await service.listUsers(String(req.query.search || '').trim(), String(req.query.status || 'ALL').toUpperCase(), String(req.query.role || 'ALL').toUpperCase()),
}));
const detail = asyncHandler(async (req, res) => success(res, 200, { user: await service.getUser(req.params.userId) }));
module.exports = { list, detail };
