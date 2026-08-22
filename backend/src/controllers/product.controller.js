const productService = require('../services/product.service');
const asyncHandler = require('../utils/async-handler');

const listMyProducts = asyncHandler(async (req, res) => {
  const data = await productService.listMyProducts(req.user);
  res.status(200).json({ data });
});

const getMyProduct = asyncHandler(async (req, res) => {
  const data = await productService.getMyProduct(req.user, Number(req.params.id));
  res.status(200).json({ data });
});

const createMyProduct = asyncHandler(async (req, res) => {
  const data = await productService.createMyProduct(req.user, req.validatedBody);
  res.status(201).json({ data });
});

const updateMyProduct = asyncHandler(async (req, res) => {
  const data = await productService.updateMyProduct(req.user, Number(req.params.id), req.validatedBody);
  res.status(200).json({ data });
});

const deleteMyProduct = asyncHandler(async (req, res) => {
  await productService.deleteMyProduct(req.user, Number(req.params.id));
  res.status(204).send();
});

module.exports = { listMyProducts, getMyProduct, createMyProduct, updateMyProduct, deleteMyProduct };
