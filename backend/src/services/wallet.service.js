const walletRepository = require('../repositories/wallet.repository');
const withdrawalRepository = require('../repositories/withdrawal.repository');

async function getWallet(userId) {
  await walletRepository.ensureWallet(userId);
  const wallet = await walletRepository.findByUserId(userId);
  const transactions = await walletRepository.listTransactions(userId, 20);
  const totals = await walletRepository.getTotals(userId);
  const withdrawal = await withdrawalRepository.getPendingSummary(userId);
  return { ...wallet, ...totals, transactions, withdrawal };
}

module.exports = { getWallet };