const orderRepository = require('../repositories/order.repository');
const { withTransaction } = require('../utils/transaction');
const AppError = require('../utils/app-error');
const { loadCredentials } = require('./product.service');

async function createOrder(user, productId) {
  if (!user.accountVerified) throw new AppError('Please verify your email and phone number before purchasing.', 403, 'ACCOUNT_NOT_VERIFIED');
  return withTransaction(async (connection) => {
    const product = await orderRepository.findProductForPurchase(productId, connection);
    if (!product) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    if (product.status !== 'ACTIVE') throw new AppError('This product is no longer available.', 409, 'PRODUCT_NOT_AVAILABLE');
    if (Number(product.seller_id) === Number(user.id)) throw new AppError('You cannot purchase your own product.', 400, 'OWN_PRODUCT');
    const existing = await orderRepository.findPendingByBuyerAndProduct(user.id, productId, connection);
    if (existing) return existing;
    const orderId = await orderRepository.create({ productId: Number(product.id), buyerId: Number(user.id), sellerId: Number(product.seller_id), amount: Number(product.price) }, connection);
    return orderRepository.findByIdForUser(orderId, user.id, connection);
  });
}

async function payOrder(user, orderId) {
  if (!user.accountVerified) throw new AppError('Please verify your email and phone number before purchasing.', 403, 'ACCOUNT_NOT_VERIFIED');
  return withTransaction(async (connection) => {
    const order = await orderRepository.findByIdForPayment(orderId, user.id, connection);
    if (!order) throw new AppError('Order not found.', 404, 'ORDER_NOT_FOUND');
    if (order.status !== 'PENDING') throw new AppError('This order cannot be paid.', 409, 'ORDER_NOT_PAYABLE');
    if (order.product_status !== 'ACTIVE') throw new AppError('This product is no longer available.', 409, 'PRODUCT_NOT_AVAILABLE');

    const [buyerWalletRows] = await connection.execute('SELECT balance FROM wallets WHERE user_id=? FOR UPDATE', [user.id]);
    const buyerBalance = Number(buyerWalletRows[0]?.balance || 0);
    const amount = Number(order.amount);
    const [withdrawalRows] = await connection.execute("SELECT COALESCE(SUM(amount),0) AS pending_withdrawal FROM withdrawal_requests WHERE user_id=? AND status='PENDING'", [user.id]);
    const pendingWithdrawal = Number(withdrawalRows[0]?.pending_withdrawal || 0);
    if (buyerBalance - pendingWithdrawal < amount) throw new AppError('Insufficient available wallet balance. Some points are currently reserved for a pending withdrawal.', 400, 'INSUFFICIENT_AVAILABLE_BALANCE');

    const newBuyerBalance = buyerBalance - amount;
    await connection.execute('UPDATE wallets SET balance=? WHERE user_id=?', [newBuyerBalance, user.id]);
    await connection.execute("INSERT INTO wallet_transactions (wallet_user_id,type,amount,balance_after,reference_type,reference_id,note) VALUES (?,'PURCHASE',?,?,?,?,?)", [user.id, amount, newBuyerBalance, 'ORDER', order.id, 'Order payment']);

    await connection.execute('INSERT INTO wallets (user_id,balance) VALUES (?,0) ON DUPLICATE KEY UPDATE user_id=user_id', [order.seller_id]);
    const [sellerWalletRows] = await connection.execute('SELECT balance FROM wallets WHERE user_id=? FOR UPDATE', [order.seller_id]);
    const sellerBalance = Number(sellerWalletRows[0]?.balance || 0);
    const newSellerBalance = sellerBalance + amount;
    await connection.execute('UPDATE wallets SET balance=? WHERE user_id=?', [newSellerBalance, order.seller_id]);
    await connection.execute("INSERT INTO wallet_transactions (wallet_user_id,type,amount,balance_after,reference_type,reference_id,note) VALUES (?,'SALE',?,?,?,?,?)", [order.seller_id, amount, newSellerBalance, 'ORDER', order.id, 'Immediate seller payment']);

    await orderRepository.markCompletedAndProductSold(order.id, order.product_id, connection);
    return orderRepository.findByIdForUser(order.id, user.id, connection);
  });
}

async function listOrders(userId) { return orderRepository.listByUser(userId); }

async function getOrder(userId, orderId) {
  const order = await orderRepository.findByIdForUser(orderId, userId);
  if (!order) throw new AppError('Order not found.', 404, 'ORDER_NOT_FOUND');
  return order;
}

async function getOrderCredentials(userId, orderId) {
  const order = await orderRepository.findByIdForUser(orderId, userId);
  if (!order) throw new AppError('Order not found.', 404, 'ORDER_NOT_FOUND');
  if (!['PAID', 'COMPLETED'].includes(order.status)) throw new AppError('Account credentials are available after successful payment only.', 403, 'ORDER_NOT_PAID');
  const productId = order.productId ?? order.product_id;
  if (!Number.isInteger(Number(productId)) || Number(productId) <= 0) throw new AppError('Invalid product information for this order.', 500, 'INVALID_ORDER_PRODUCT');
  const credentials = await loadCredentials(Number(productId));
  if (!credentials) throw new AppError('Account credentials are not available.', 404, 'CREDENTIALS_NOT_FOUND');
  return credentials;
}

module.exports = { createOrder, payOrder, listOrders, getOrder, getOrderCredentials };
