const userRepository =
  require('../repositories/user.repository');

const AppError =
  require('../utils/app-error');

const { pool } =
  require('../config/database');


async function listSuspended() {
  return userRepository.listAdminSuspended();
}


async function setStatus(
  adminId,
  userId,
  data
) {
  const id = Number(userId);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new AppError(
      'Invalid user id.',
      400,
      'INVALID_USER_ID'
    );
  }

  if (id === Number(adminId)) {
    throw new AppError(
      'You cannot change your own admin status.',
      403,
      'SELF_MODERATION_FORBIDDEN'
    );
  }

  const status =
    String(data.status || '')
      .trim()
      .toUpperCase();

  if (
    !['ACTIVE', 'BANNED']
      .includes(status)
  ) {
    throw new AppError(
      'Invalid moderation status.',
      400,
      'INVALID_MODERATION_STATUS'
    );
  }

  const reason =
    String(data.reason || '')
      .trim();

  if (
    status === 'BANNED' &&
    !reason
  ) {
    throw new AppError(
      'A reason is required for banning this account.',
      400,
      'BAN_REASON_REQUIRED'
    );
  }

  if (reason.length > 500) {
    throw new AppError(
      'Reason must not exceed 500 characters.',
      400,
      'BAN_REASON_TOO_LONG'
    );
  }

  return userRepository.adminSetStatus(
    pool,
    id,
    status,
    status === 'ACTIVE'
      ? null
      : reason,
    null
  );
}


module.exports = {
  listSuspended,
  setStatus,
};