const service = require('../services/public-product-list.service');
const asyncHandler = require('../utils/async-handler');

const listPublicProducts = asyncHandler(async (req, res) => {
  const data = await service.listPublicProducts(req.query);
  res.status(200).json({ data });
});

module.exports = { listPublicProducts };
