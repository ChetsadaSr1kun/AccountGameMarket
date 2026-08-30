const AppError = require('../utils/app-error');
const repo = require('../repositories/chat.repository');
const notificationService = require('./notification.service');

async function listConversations(userId){return repo.listForUser(userId);}
async function openConversation(userId,otherUserId,productId){
  const uid=Number(userId), oid=Number(otherUserId), pid=productId==null?null:Number(productId);
  if(!Number.isInteger(oid)||oid<=0)throw new AppError('Invalid user.',400,'INVALID_USER');
  if(oid===uid)throw new AppError('Cannot chat with yourself.',400,'INVALID_PARTICIPANT');
  let buyerId, sellerId;
  if(pid!==null){
    const [rows] = await require('../config/database').pool.execute('SELECT seller_id FROM products WHERE id=? LIMIT 1',[pid]);
    if(!rows[0])throw new AppError('Product not found.',404,'PRODUCT_NOT_FOUND');
    sellerId=Number(rows[0].seller_id);
    if(uid===sellerId){buyerId=oid;} else if(oid===sellerId){buyerId=uid;} else throw new AppError('Chat participants must be related to the selected product.',403,'INVALID_PARTICIPANTS');
  } else { buyerId=Math.min(uid,oid); sellerId=Math.max(uid,oid); }
  return repo.findOrCreateConversation(buyerId,sellerId,pid);
}
async function getConversation(userId,id){const c=await repo.getForUser(Number(id),userId);if(!c)throw new AppError('Conversation not found.',404,'CONVERSATION_NOT_FOUND');const messages=await repo.listMessages(c.id);return {conversation:c,messages};}
async function sendMessage(userId,id,body){const c=await repo.getForUser(Number(id),userId);if(!c)throw new AppError('Conversation not found.',404,'CONVERSATION_NOT_FOUND');const text=String(body||'').trim();if(!text||text.length>2000)throw new AppError('Message must be 1-2000 characters.',400,'INVALID_MESSAGE');const message=await repo.createMessage(c.id,userId,text);const recipientId=Number(c.buyer_id)===Number(userId)?Number(c.seller_id):Number(c.buyer_id);try{await notificationService.create({userId:recipientId,type:'NEW_MESSAGE',title:'มีข้อความใหม่',message:`${message.sender_username} ส่งข้อความถึงคุณ`,referenceType:'CHAT',referenceId:c.id});}catch(error){console.error('notification create failed after message:',error.message);}return message;}
async function listAdminMessages(limit){return repo.listAdmin(Math.min(Math.max(Number(limit)||100,1),500));}
module.exports={listConversations,openConversation,getConversation,sendMessage,listAdminMessages};
