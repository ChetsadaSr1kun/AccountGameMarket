const asyncHandler = require('../utils/async-handler');
const repository = require('../repositories/home.repository');

const stats = asyncHandler(async (req, res) => {
  res.status(200).json({ data: await repository.getStats() });
});

module.exports = { stats };
