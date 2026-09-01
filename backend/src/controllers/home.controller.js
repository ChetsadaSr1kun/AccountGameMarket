const repository = require('../repositories/home.repository');
const asyncHandler = require('../utils/async-handler');

const stats = asyncHandler(async (req, res) => {
  res.status(200).json({ data: await repository.getStats() });
});

const me = asyncHandler(async (req, res) => {
  res.status(200).json({ data: await repository.getUserHome(req.user.id) });
});

module.exports = { stats, me };
