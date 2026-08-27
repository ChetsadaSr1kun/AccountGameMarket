const orderRepository = require('../repositories/order.repository');
const orderService = require('./order.service');
const walletRepository = require('../repositories/wallet.repository');
const withdrawalRepository = require('../repositories/withdrawal.repository');

async function getWallet(userId) {
  await orderService.releaseExpiredSellerFunds();
  await walletRepository.ensureWallet(userId);
  const wallet = await walletRepository.findByUserId(userId);
  const transactions = await walletRepository.listTransactions(userId, 20);
  const held = await orderRepository.getPendingSellerSummary(userId);
  const withdrawal = await withdrawalRepository.getPendingSummary(userId);
  return { ...wallet, transactions, held, withdrawal };
}

module.exports = { getWallet };