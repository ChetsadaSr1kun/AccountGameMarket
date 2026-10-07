// These projections preserve each API's ID namespace without mixing participants.
const userConversations = `(SELECT id,buyer_id,seller_id,product_id,participant_low_id,
  participant_high_id,created_at,updated_at FROM conversations WHERE conversation_type='USER')`;
const userMessages = `(SELECT m.id,m.conversation_id,m.sender_id,m.body,m.created_at
  FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.conversation_type='USER')`;
const supportConversations = `(SELECT COALESCE(legacy_support_id,id) id,support_user_id user_id,
  assigned_admin_id,support_status status,user_last_read_message_id,admin_last_read_message_id,
  created_at,updated_at,closed_at FROM conversations WHERE conversation_type='SUPPORT')`;
const supportMessages = `(SELECT COALESCE(m.legacy_support_id,m.id) id,
  COALESCE(c.legacy_support_id,c.id) conversation_id,m.sender_id,m.body,m.created_at
  FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.conversation_type='SUPPORT')`;
module.exports = { userConversations, userMessages, supportConversations, supportMessages };
