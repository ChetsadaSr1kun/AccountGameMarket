const AppError =
  require('../utils/app-error');

const repository =
  require(
    '../repositories/support-chat.repository'
  );


function validUserId(value) {
  const id = Number(value);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new AppError(
      'Invalid user.',
      400,
      'INVALID_USER'
    );
  }

  return id;
}


function validMessage(body) {
  const text =
    String(body || '').trim();

  if (
    !text ||
    text.length > 2000
  ) {
    throw new AppError(
      'Message must be 1-2000 characters.',
      400,
      'INVALID_MESSAGE'
    );
  }

  return text;
}


function mapConversation(row) {
  if (!row) return null;

  return {
    id: Number(row.id),

    userId:
      Number(row.user_id),

    assignedAdminId:
      row.assigned_admin_id == null
        ? null
        : Number(
            row.assigned_admin_id
          ),

    status:
      row.status,

    userUsername:
      row.user_username,

    userAvatar:
      row.user_avatar || null,

    assignedAdminUsername:
      row.assigned_admin_username ||
      null,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,

    closedAt:
      row.closed_at || null,
  };
}


function mapMessage(row) {
  if (!row) return null;

  return {
    id: Number(row.id),

    conversationId:
      Number(row.conversation_id),

    senderId:
      Number(row.sender_id),

    senderUsername:
      row.sender_username,

    senderAvatar:
      row.sender_avatar || null,

    body:
      row.body,

    createdAt:
      row.created_at,
  };
}


async function getUserSupport(
  userId
) {
  const id =
    validUserId(userId);

  const conversation =
    await repository
      .findOrCreateForUser(id);

  const messages =
    await repository.listMessages(
      conversation.id
    );

  await repository.markUserRead(
    conversation.id,
    id
  );

  return {
    conversation:
      mapConversation(
        conversation
      ),

    messages:
      messages.map(mapMessage),
  };
}


async function sendUserMessage(
  userId,
  body
) {
  const id =
    validUserId(userId);

  const text =
    validMessage(body);

  const conversation =
    await repository
      .findOrCreateForUser(id);

  const message =
    await repository.createMessage(
      conversation.id,
      id,
      text
    );

  return mapMessage(message);
}


async function getUserUnreadCount(
  userId
) {
  const id =
    validUserId(userId);

  return repository
    .getUserUnreadCount(id);
}

function validConversationId(value) {
  const id = Number(value);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new AppError(
      'Invalid support conversation.',
      400,
      'INVALID_SUPPORT_CONVERSATION'
    );
  }

  return id;
}

function mapAdminConversation(row) {
  if (!row) return null;

  return {
    id: Number(row.id),

    userId:
      Number(row.user_id),

    userUsername:
      row.user_username,

    userAvatar:
      row.user_avatar || null,

    assignedAdminId:
      row.assigned_admin_id == null
        ? null
        : Number(
            row.assigned_admin_id
          ),

    assignedAdminUsername:
      row.assigned_admin_username ||
      null,

    status:
      row.status,

    lastMessage:
      row.last_message || '',

    lastMessageAt:
      row.last_message_at || null,

    unreadCount:
      Number(
        row.unread_count || 0
      ),

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}

async function listAdminSupport() {
  const rows =
    await repository.listForAdmin();

  return rows.map(
    mapAdminConversation
  );
}


async function getAdminSupport(
  conversationId
) {
  const id =
    validConversationId(
      conversationId
    );

  const conversation =
    await repository.findById(id);

  if (!conversation) {
    throw new AppError(
      'Support conversation not found.',
      404,
      'SUPPORT_CONVERSATION_NOT_FOUND'
    );
  }

  const messages =
    await repository.listMessages(id);

  await repository.markAdminRead(id);

  return {
    conversation:
      mapConversation(
        conversation
      ),

    messages:
      messages.map(mapMessage),
  };
}


async function sendAdminMessage(
  adminId,
  conversationId,
  body
) {
  const senderId =
    validUserId(adminId);

  const id =
    validConversationId(
      conversationId
    );

  const text =
    validMessage(body);

  const conversation =
    await repository.findById(id);

  if (!conversation) {
    throw new AppError(
      'Support conversation not found.',
      404,
      'SUPPORT_CONVERSATION_NOT_FOUND'
    );
  }

  const message =
    await repository.createMessage(
      id,
      senderId,
      text
    );

  return mapMessage(message);
}

module.exports = {
  getUserSupport,
  sendUserMessage,
  getUserUnreadCount,

  listAdminSupport,
  getAdminSupport,
  sendAdminMessage,
};