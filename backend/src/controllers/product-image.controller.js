const productImageService = require('../services/product-image.service');
const asyncHandler = require('../utils/async-handler');

const listMyProductImages = asyncHandler(async (req, res) => {
  const data = await productImageService.listMyProductImages(req.user, Number(req.params.id));
  res.status(200).json({ data });
});

const uploadMyProductImages = asyncHandler(async (req, res) => {
  const data = await productImageService.uploadMyProductImages(req.user, Number(req.params.id), req.files);
  res.status(201).json({ data });
});

const deleteMyProductImage = asyncHandler(async (req, res) => {
  await productImageService.deleteMyProductImage(req.user, Number(req.params.id), Number(req.params.imageId));
  res.status(204).send();
});

module.exports = { listMyProductImages, uploadMyProductImages, deleteMyProductImage };