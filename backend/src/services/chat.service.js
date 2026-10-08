const AppError = require('../utils/app-error');
const repo = require('../repositories/chat.repository');
const notificationService = require('./notification.service');

async function listConversations(userId){return repo.listForUser(userId);}
async function countUnread(
  userId
) {
  return repo.countUnreadForUser(
    userId
  );
}
async function openConversation(
  userId,
  otherUserId,
  productId
) {
  const uid =
    Number(userId);

  const oid =
    Number(otherUserId);

  const pid =
    productId == null
      ? null
      : Number(productId);

  if (
    !Number.isInteger(oid) ||
    oid <= 0
  ) {
    throw new AppError(
      'Invalid user.',
      400,
      'INVALID_USER'
    );
  }

  if (oid === uid) {
    throw new AppError(
      'Cannot chat with yourself.',
      400,
      'INVALID_PARTICIPANT'
    );
  }

  if (pid !== null) {
    const [rows] =
      await require('../config/database')
        .pool
        .execute(
          `
            SELECT seller_id
            FROM products
            WHERE id = ?
            LIMIT 1
          `,
          [pid]
        );

    if (!rows[0]) {
      throw new AppError(
        'Product not found.',
        404,
        'PRODUCT_NOT_FOUND'
      );
    }

    const productSellerId =
      Number(rows[0].seller_id);

    if (
      uid !== productSellerId &&
      oid !== productSellerId
    ) {
      throw new AppError(
        'Chat participants must be related to the selected product.',
        403,
        'INVALID_PARTICIPANTS'
      );
    }
  }

  const participantLowId =
    Math.min(uid, oid);

  const participantHighId =
    Math.max(uid, oid);

  return repo.findOrCreateConversation(
    participantLowId,
    participantHighId,
    pid
  );
}
async function getConversation(
  userId,
  id
) {
  const conversation =
    await repo.getForUser(
      Number(id),
      userId
    );

  if (!conversation) {
    throw new AppError(
      'Conversation not found.',
      404,
      'CONVERSATION_NOT_FOUND'
    );
  }

  const messages =
    await repo.listMessages(
      conversation.id
    );

  await repo.markConversationRead(
    conversation.id,
    userId
  );

  await notificationService.markChatRead(
    userId,
    conversation.id
  );

  return {
    conversation,
    messages,
  };
}
async function sendMessage(userId,id,body){const c=await repo.getForUser(Number(id),userId);if(!c)throw new AppError('Conversation not found.',404,'CONVERSATION_NOT_FOUND');const text=String(body||'').trim();if(!text||text.length>2000)throw new AppError('Message must be 1-2000 characters.',400,'INVALID_MESSAGE');const message=await repo.createMessage(c.id,userId,text);const recipientId=Number(c.buyer_id)===Number(userId)?Number(c.seller_id):Number(c.buyer_id);try{await notificationService.create({userId:recipientId,type:'NEW_MESSAGE',title:'มีข้อความใหม่',message:`${message.sender_username} ส่งข้อความถึงคุณ`,referenceType:'CHAT',referenceId:c.id});}catch(error){console.error('notification create failed after message:',error.message);}return message;}
async function listAdminMessages(limit){return repo.listAdmin(Math.min(Math.max(Number(limit)||100,1),500));}
module.exports = {
  listConversations,
  countUnread,
  openConversation,
  getConversation,
  sendMessage,
  listAdminMessages,
};