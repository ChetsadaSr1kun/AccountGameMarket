const chatService = require('../services/chat.service');
const asyncHandler=require('../utils/async-handler');
const {success}=require('../utils/response');
const list=asyncHandler(async(req,res)=>success(res,200,{conversations:await chatService.listConversations(req.user.id)}));
const open=asyncHandler(async(req,res)=>success(res,201,{conversation:await chatService.openConversation(req.user.id,Number(req.body?.otherUserId),req.body?.productId??null)}));
const detail=asyncHandler(async(req,res)=>success(res,200,await chatService.getConversation(req.user.id,Number(req.params.id))));
const send=asyncHandler(async(req,res)=>success(res,201,{message:await chatService.sendMessage(req.user.id,Number(req.params.id),req.body?.body)}));
const adminList=asyncHandler(async(req,res)=>success(res,200,{messages:await chatService.listAdminMessages(req.query?.limit)}));
module.exports={list,open,detail,send,adminList};
