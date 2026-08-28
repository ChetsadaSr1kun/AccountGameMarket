const service = require('../services/admin-product.service');
const asyncHandler = require('../utils/async-handler');
const { success } = require('../utils/response');

const list = asyncHandler(async (req, res) => success(res, 200, {
  products: await service.listProducts(String(req.query.search || '').trim(), String(req.query.status || 'ALL').toUpperCase(), String(req.query.gameId || 'ALL')),
}));
const detail = asyncHandler(async (req, res) => success(res, 200, { product: await service.getProduct(req.params.productId) }));
const getSummary = asyncHandler(async (req, res) => success(res, 200, { summary: await service.summary() }));
const moderate = asyncHandler(async (req, res) => success(res, 200, { product: await service.moderate(req.user.id, req.params.productId, req.body?.status, req.body?.reason) }));
module.exports = { list, detail, getSummary, moderate };
