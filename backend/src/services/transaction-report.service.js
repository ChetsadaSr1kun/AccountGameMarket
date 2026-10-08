const AppError = require('../utils/app-error');
const repository = require('../repositories/transaction-report.repository');
const chatRepository =
  require('../repositories/chat.repository');

const REASONS = new Set([
  'SCAM',
  'ITEM_NOT_AS_DESCRIBED',
  'HARASSMENT',
  'NO_DELIVERY',
  'CHAT_ABUSE',
  'OTHER'
]);

const ADMIN_STATUSES = new Set([
  'RESOLVED'
]);

const ADMIN_OUTCOMES = new Set([
  'ACTION_TAKEN',
  'NO_VIOLATION'
]);

const ALLOWED_TRANSITIONS = {
  PENDING: new Set([
    'RESOLVED'
  ]),
};

function mapReport(row) {
  return {
    id: Number(row.id),
    orderId: Number(row.order_id),
    reporterId: Number(row.reporter_id),
    reportedId: Number(row.reported_id),

    reason: row.reason,
    description: row.description || '',

    status: row.status,
    outcome: row.outcome || null,

    adminNote: row.admin_note || null,

    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,

    reportedUsername:
      row.reported_username,

    reportedAvatarUrl:
      row.reported_avatar_url || null,

    reporterUsername:
      row.reporter_username,

    reporterAvatarUrl:
      row.reporter_avatar_url || null,

    buyerUsername:
      row.buyer_username || null,

    sellerUsername:
      row.seller_username || null,

    productTitle:
      row.product_title,

    amount:
      Number(row.amount || 0),

    orderStatus:
      row.order_status,

    gameName:
      row.game_name || null,

    productStatus:
      row.product_status || null,

    orderCreatedAt:
      row.order_created_at || null,

    orderUpdatedAt:
      row.order_updated_at || null,

    orderCompletedAt:
      row.order_completed_at || null,

    productPrice:
      row.product_price == null
        ? null
        : Number(row.product_price),

    productId:
      row.product_id == null
        ? null
        : Number(row.product_id),

    buyerId:
      row.buyer_id == null
        ? null
        : Number(row.buyer_id),

    sellerId:
      row.seller_id == null
        ? null
        : Number(row.seller_id),

    reporterEmail:
      row.reporter_email || null,

    reportedEmail:
      row.reported_email || null,

    reportedStatus:
      row.reported_status || null,
  };
}

async function createReport(
  reporterId,
  data
) {
  const orderId =
    Number(data.orderId);

  const reason =
    String(data.reason || '')
      .trim()
      .toUpperCase();

  const description =
    String(data.description || '')
      .trim();

  if (
    !Number.isInteger(orderId) ||
    orderId <= 0
  ) {
    throw new AppError(
      'A valid orderId is required.',
      400,
      'INVALID_ORDER_ID'
    );
  }

  if (!REASONS.has(reason)) {
    throw new AppError(
      'Invalid report reason.',
      400,
      'INVALID_REPORT_REASON'
    );
  }

  if (description.length > 500) {
    throw new AppError(
      'Report description must not exceed 500 characters.',
      400,
      'DESCRIPTION_TOO_LONG'
    );
  }

  const order =
    await repository
      .findOrderParticipant(
        orderId,
        reporterId
      );

  if (!order) {
    throw new AppError(
      'You may report only the other participant in your own transaction.',
      403,
      'TRANSACTION_NOT_OWNED'
    );
  }

  if (
    ['PENDING', 'CANCELLED']
      .includes(order.status)
  ) {
    throw new AppError(
      'This transaction is not eligible for reporting yet.',
      403,
      'TRANSACTION_NOT_REPORTABLE'
    );
  }

  const reportedId =
    Number(order.buyer_id) ===
    Number(reporterId)
      ? Number(order.seller_id)
      : Number(order.buyer_id);

  if (
    await repository.findExisting(
      orderId,
      reporterId
    )
  ) {
    throw new AppError(
      'You have already reported this transaction.',
      409,
      'REPORT_ALREADY_EXISTS'
    );
  }

  return mapReport(
    await repository.create({
      orderId,
      reporterId,
      reportedId,
      reason,
      description,
    })
  );
}

async function listAdminReports() {
  return (
    await repository.listAdminReports()
  ).map(mapReport);
}

async function listPendingReports() {
  return (
    await repository.listPending()
  )
    .filter(
      (report) =>
        report.status === 'PENDING'
    )
    .map(mapReport);
}

async function getReportDetail(
  reportId
) {
  const id = Number(reportId);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new AppError(
      'A valid reportId is required.',
      400,
      'INVALID_REPORT_ID'
    );
  }

  const report =
    await repository.findDetailById(id);

  if (!report) {
    throw new AppError(
      'Transaction report not found.',
      404,
      'REPORT_NOT_FOUND'
    );
  }

  return mapReport(report);
}

async function getReportChat(
  reportId
) {
  /*
   * Reuse the report-detail lookup so:
   * - reportId is validated
   * - missing reports return the existing
   *   REPORT_NOT_FOUND error
   * - participant ids come from the real report
   */
  const report =
    await getReportDetail(
      reportId
    );

  const conversation =
    await chatRepository
      .findConversationBetweenUsers(
        report.reporterId,
        report.reportedId
      );

  const baseResult = {
    reportId:
      Number(report.id),

    orderId:
      Number(report.orderId),

    reporter: {
      id:
        Number(report.reporterId),

      username:
        report.reporterUsername ||
        '-',

      avatarUrl:
        report.reporterAvatarUrl ||
        null,
    },

    reported: {
      id:
        Number(report.reportedId),

      username:
        report.reportedUsername ||
        '-',

      avatarUrl:
        report.reportedAvatarUrl ||
        null,
    },
  };

  /*
   * No conversation is a valid state.
   * Do not create one just because
   * an admin is reviewing a report.
   */
  if (!conversation) {
    return {
      ...baseResult,
      conversation: null,
      messages: [],
    };
  }

  const messages =
    await chatRepository
      .listRecentMessagesForAdmin(
        conversation.id,
        200
      );

  return {
    ...baseResult,

    conversation: {
      id:
        Number(conversation.id),

      createdAt:
        conversation.created_at,

      updatedAt:
        conversation.updated_at,
    },

    messages:
      messages.map(
        (message) => ({
          id:
            Number(message.id),

          senderId:
            Number(
              message.sender_id
            ),

          senderUsername:
            message.sender_username,

          senderAvatarUrl:
            message.sender_avatar ||
            null,

          body:
            message.body,

          createdAt:
            message.created_at,
        })
      ),
  };
}

async function updateReport(
  adminId,
  reportId,
  data
) {
  const id =
    Number(reportId);

  const status =
    String(data.status || '')
      .trim()
      .toUpperCase();

  const outcome =
    String(data.outcome || '')
      .trim()
      .toUpperCase();

  const note =
    String(data.adminNote || '')
      .trim();

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new AppError(
      'A valid reportId is required.',
      400,
      'INVALID_REPORT_ID'
    );
  }

  if (!ADMIN_STATUSES.has(status)) {
    throw new AppError(
      'Invalid report status.',
      400,
      'INVALID_REPORT_STATUS'
    );
  }

  if (!ADMIN_OUTCOMES.has(outcome)) {
    throw new AppError(
      'Invalid report outcome.',
      400,
      'INVALID_REPORT_OUTCOME'
    );
  }

  if (note.length > 500) {
    throw new AppError(
      'Admin note must not exceed 500 characters.',
      400,
      'ADMIN_NOTE_TOO_LONG'
    );
  }

  const existing =
    await repository.findById(id);

  if (!existing) {
    throw new AppError(
      'Transaction report not found.',
      404,
      'REPORT_NOT_FOUND'
    );
  }

  if (
    !ALLOWED_TRANSITIONS[
      existing.status
    ]?.has(status)
  ) {
    throw new AppError(
      `Cannot change report from ${existing.status} to ${status}.`,
      409,
      'INVALID_REPORT_TRANSITION'
    );
  }

  return mapReport(
    await repository.updateStatus(
      id,
      status,
      outcome,
      adminId,
      note
    )
  );
}

module.exports = {
  createReport,
  listPendingReports,
  listAdminReports,
  getReportDetail,
  getReportChat,
  updateReport,
  REASONS,
};