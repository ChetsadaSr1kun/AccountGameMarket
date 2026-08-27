const walletService = require('../services/wallet.service');
const asyncHandler = require('../utils/async-handler');
const { success } = require('../utils/response');

const getWallet = asyncHandler(async (req, res) => {
  const wallet = await walletService.getWallet(req.user.id);
  return success(res, 200, { wallet });
});

module.exports = { getWallet };