const AppError = require('../utils/app-error');
const repository = require('../repositories/notification.repository');

const TYPES = new Set([
  'ORDER_PURCHASE','ORDER_SOLD','ORDER_CANCELLED','WALLET_TOPUP',
  'WALLET_WITHDRAW_APPROVED','WALLET_WITHDRAW_REJECTED',
  'SELLER_VERIFICATION_SUBMITTED','SELLER_VERIFICATION_APPROVED','SELLER_VERIFICATION_REJECTED',
  'NEW_MESSAGE','NEW_REVIEW','PRODUCT_REPORTED','PRODUCT_HIDDEN','PRODUCT_RESTORED',
]);

function validateId(id) {
  const value = Number(id);
  if (!Number.isInteger(value) || value <= 0) throw new AppError('Invalid notification id.',400,'INVALID_NOTIFICATION_ID');
  return value;
}

function map(row) {
  return { id:Number(row.id), type:row.type, title:row.title, message:row.message,
    referenceType:row.reference_type, referenceId:row.reference_id==null?null:Number(row.reference_id),
    isRead:Boolean(row.is_read), createdAt:row.created_at, readAt:row.read_at };
}

async function create(data, executor) {
  if (!data?.userId || !TYPES.has(String(data.type))) throw new AppError('Invalid notification data.',400,'INVALID_NOTIFICATION_DATA');
  return map(await repository.create(data, executor));
}
async function list(userId) { return (await repository.listByUserId(userId)).map(map); }
async function count(userId) { return repository.unreadCount(userId); }
async function markRead(userId,id) { return map(await repository.markRead(userId,validateId(id))); }
async function markAllRead(userId) { return repository.markAllRead(userId); }

module.exports = { create, list, count, markRead, markAllRead };
