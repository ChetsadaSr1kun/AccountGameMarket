const publicProductService = require('../services/public-product.service');
const asyncHandler = require('../utils/async-handler');

const getPublicProduct = asyncHandler(async (req, res) => {
  const data = await publicProductService.getPublicProduct(Number(req.params.id));
  res.status(200).json({ data });
});

module.exports = { getPublicProduct };