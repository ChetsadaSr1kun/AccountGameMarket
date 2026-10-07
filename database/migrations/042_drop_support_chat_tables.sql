CREATE TEMPORARY TABLE support_drop_guard (mismatches BIGINT NOT NULL CHECK (mismatches=0));
INSERT INTO support_drop_guard SELECT COUNT(*) FROM support_conversations s
LEFT JOIN conversations c ON c.legacy_support_id=s.id AND c.conversation_type='SUPPORT'
WHERE c.id IS NULL OR NOT (s.user_id <=> c.support_user_id)
  OR NOT (s.assigned_admin_id <=> c.assigned_admin_id) OR NOT (s.status <=> c.support_status)
  OR NOT (s.user_last_read_message_id <=> c.user_last_read_message_id)
  OR NOT (s.admin_last_read_message_id <=> c.admin_last_read_message_id)
  OR NOT (s.created_at <=> c.created_at) OR NOT (s.updated_at <=> c.updated_at)
  OR NOT (s.closed_at <=> c.closed_at);
INSERT INTO support_drop_guard SELECT COUNT(*) FROM support_messages s
LEFT JOIN messages m ON m.legacy_support_id=s.id
LEFT JOIN conversations c ON c.id=m.conversation_id
WHERE m.id IS NULL OR NOT (c.legacy_support_id <=> s.conversation_id)
  OR c.conversation_type<>'SUPPORT' OR NOT (s.sender_id <=> m.sender_id)
  OR NOT (BINARY s.body <=> BINARY m.body) OR NOT (s.created_at <=> m.created_at);
DROP TABLE support_messages;
DROP TABLE support_conversations;
DROP TEMPORARY TABLE support_drop_guard;
