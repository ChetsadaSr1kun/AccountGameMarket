const orderService = require('../services/order.service');
const asyncHandler = require('../utils/async-handler');
const { success } = require('../utils/response');

const createOrder = asyncHandler(async (req, res) => {
  const productId = Number(req.body?.productId);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ error: { code: 'INVALID_PRODUCT_ID', message: 'A valid productId is required.' } });
  }
  const order = await orderService.createOrder(req.user, productId);
  return success(res, 201, { order });
});

const payOrder = asyncHandler(async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: { code: 'INVALID_ORDER_ID', message: 'A valid order id is required.' } });
  }
  const order = await orderService.payOrder(req.user, orderId);
  return success(res, 200, { order });
});

const confirmOrderReceived = asyncHandler(async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: { code: 'INVALID_ORDER_ID', message: 'A valid order id is required.' } });
  }
  const order = await orderService.confirmOrderReceived(req.user.id, orderId);
  return success(res, 200, { order });
});

const listOrders = asyncHandler(async (req, res) => {
  const orders = await orderService.listOrders(req.user.id);
  return success(res, 200, { orders });
});

const getOrder = asyncHandler(async (req, res) => {
  const order = await orderService.getOrder(req.user.id, Number(req.params.id));
  return success(res, 200, { order });
});

const getOrderCredentials = asyncHandler(async (req, res) => {
  const credentials = await orderService.getOrderCredentials(req.user.id, Number(req.params.id));
  return success(res, 200, { credentials });
});

module.exports = { createOrder, payOrder, confirmOrderReceived, listOrders, getOrder, getOrderCredentials };