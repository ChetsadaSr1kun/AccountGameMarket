const walletRepository = require('../repositories/wallet.repository');
const orderRepository = require('../repositories/order.repository');
const { withTransaction } = require('../utils/transaction');
const AppError = require('../utils/app-error');
const { loadCredentials } = require('./product.service');
const notificationService = require('./notification.service');
const {
  calculateVatSettlement,
} = require('../utils/marketplace-vat');

async function createOrder(user, productId) {
  if (!user.accountVerified) throw new AppError('Please verify your email and phone number before purchasing.', 403, 'ACCOUNT_NOT_VERIFIED');
  return withTransaction(async (connection) => {
    const product = await orderRepository.findProductForPurchase(productId, connection);
    if (!product) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    if (product.status !== 'ACTIVE') throw new AppError('This product is no longer available.', 409, 'PRODUCT_NOT_AVAILABLE');
    if (Number(product.seller_id) === Number(user.id)) throw new AppError('You cannot purchase your own product.', 400, 'OWN_PRODUCT');
    const existing =
      await orderRepository
        .findPendingByBuyerAndProduct(
          user.id,
          productId,
          connection
        );

    if (existing) {
      return existing;
    }

    const settlement =
      calculateVatSettlement(
        product.price
      );

    const orderId =
      await orderRepository.create(
        {
          productId:
            Number(product.id),

          buyerId:
            Number(user.id),

          sellerId:
            Number(product.seller_id),

          amount:
            settlement.grossAmount,

          vatRatePercent:
            settlement.vatRatePercent,

          vatAmount:
            settlement.vatAmount,

          sellerNetAmount:
            settlement.sellerNetAmount,
        },
        connection
      );
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

    const amount = order.amount;
    const sellerNetAmount = order.seller_net_amount ?? amount;
    const reserved = await walletRepository.reserveBalance(user.id, amount, connection);
    if (!reserved) {
      throw new AppError('Insufficient wallet balance.', 400, 'INSUFFICIENT_BALANCE');
    }
    const newBuyerBalance = await walletRepository.getBalanceDecimal(user.id, connection);
    await connection.execute("INSERT INTO wallet_transactions (wallet_user_id,type,amount,balance_after,reference_type,reference_id,note) VALUES (?,'PURCHASE',?,?,?,?,?)", [user.id, amount, newBuyerBalance, 'ORDER', order.id, 'Order payment']);
    const newSellerBalance = await walletRepository.creditBalance(order.seller_id, sellerNetAmount, connection);
    await connection.execute(
      "INSERT INTO wallet_transactions (wallet_user_id,type,amount,balance_after,reference_type,reference_id,note) VALUES (?,'SALE',?,?,?,?,?)",
      [
        order.seller_id,
        sellerNetAmount,
        newSellerBalance,
        'ORDER',
        order.id,
        'Seller net payment'
      ]
    );

    await orderRepository.markCompletedAndProductSold(order.id, order.product_id, connection);
    await notificationService.create({ userId: user.id, type: "ORDER_PURCHASE", title: "ซื้อสินค้าสำเร็จ", message: "Order #" + order.id + " ซื้อสำเร็จแล้ว", referenceType: "ORDER", referenceId: order.id }, connection);
    await notificationService.create({ userId: order.seller_id, type: "ORDER_SOLD", title: "มีการซื้อสินค้าใหม่", message: "สินค้าใน Order #" + order.id + " ถูกซื้อแล้ว", referenceType: "ORDER", referenceId: order.id }, connection);
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


