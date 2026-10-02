'use strict';

const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');
const { pool } = require('../../backend/src/config/database');
const { hashPassword } = require('../../backend/src/utils/password');
const userRepository = require('../../backend/src/repositories/user.repository');
const roleRepository = require('../../backend/src/repositories/role.repository');
const walletRepository = require('../../backend/src/repositories/wallet.repository');
const withdrawalService = require('../../backend/src/services/withdrawal.service');
const app = require('../../backend/src/app');
const { cleanupTestUsers, closeTestDatabasePool, prepareTestDatabase } = require('../helpers/test-database');

if (process.env.NODE_ENV !== 'test' || process.env.DB_NAME !== 'gamemarket_test') {
  throw new Error('Admin critical-flow tests are locked to the gamemarket_test database.');
}

const api = request(app);
const runId = crypto.randomUUID().replaceAll('-', '');
const emailPrefix = `admincritical_${runId}_`;
const password = 'TestPassword123';

let phoneSequence = 0;
let admin;
let customer;
let nonAdmin;
let seller;
let buyer;
let moderatedProductId;
let reportedProductId;
let reportedOrderId;
let transactionReportId;
let unrelatedReviewOrderId;
let targetReviewId;
let unrelatedReviewId;
let reviewReportId;
let withdrawalApprovalUser;
let withdrawalRejectionUser;
let approvalWithdrawalId;
let rejectionWithdrawalId;

function cookies(response) {
  return (response.headers['set-cookie'] || []).map((value) => value.split(';', 1)[0]).join('; ');
}

function csrf(response) {
  const csrfCookie = (response.headers['set-cookie'] || []).find((value) => value.startsWith('gm_csrf='));
  return csrfCookie?.split(';', 1)[0].slice('gm_csrf='.length);
}

function nextPhone() {
  const base = Number.parseInt(runId.slice(0, 7), 16) % 100000000;
  const number = (base + phoneSequence++) % 100000000;
  return `08${String(number).padStart(8, '0')}`;
}

async function createUser(label, roles, accountMode) {
  const username = `ac_${runId.slice(0, 14)}_${label.replace(/[^a-z0-9_]/gi, '_')}`;
  const userId = await userRepository.create(pool, {
    email: `${emailPrefix}${label}@example.test`,
    username,
    firstName: 'Admin',
    lastName: 'Fixture',
    phone: nextPhone(),
    dateOfBirth: '2000-01-01',
    passwordHash: await hashPassword(password),
    accountMode,
  });
  const roleIds = await roleRepository.findIdsByCodes(pool, roles);
  assert.equal(roleIds.length, roles.length);
  await userRepository.assignRoles(pool, userId, roleIds);
  const auth = await api.post('/api/v1/auth/login').send({ username, password });
  assert.equal(auth.status, 200);
  return { id: Number(userId), username, auth };
}

async function cleanupFixtures() {
  for (const withdrawalId of [approvalWithdrawalId, rejectionWithdrawalId].filter(Boolean)) {
    await pool.execute('DELETE FROM withdrawal_requests WHERE id = ?', [withdrawalId]);
  }
  if (reviewReportId) {
    await pool.execute('DELETE FROM review_reports WHERE id = ?', [reviewReportId]);
  }
  for (const reviewId of [targetReviewId, unrelatedReviewId].filter(Boolean)) {
    await pool.execute('DELETE FROM review_reports WHERE review_id = ?', [reviewId]);
    await pool.execute('DELETE FROM reviews WHERE id = ?', [reviewId]);
  }
  if (transactionReportId) {
    await pool.execute('DELETE FROM transaction_reports WHERE id = ?', [transactionReportId]);
  }
  if (unrelatedReviewOrderId) {
    await pool.execute('DELETE FROM orders WHERE id = ?', [unrelatedReviewOrderId]);
  }
  if (reportedOrderId) {
    await pool.execute('DELETE FROM transaction_reports WHERE order_id = ?', [reportedOrderId]);
    await pool.execute('DELETE FROM orders WHERE id = ?', [reportedOrderId]);
  }
  for (const productId of [moderatedProductId, reportedProductId].filter(Boolean)) {
    await pool.execute('DELETE FROM product_credentials WHERE product_id = ?', [productId]);
    await pool.execute('DELETE FROM product_images WHERE product_id = ?', [productId]);
    await pool.execute('DELETE FROM products WHERE id = ?', [productId]);
  }

  const [users] = await pool.execute('SELECT id FROM users WHERE email LIKE ?', [`${emailPrefix}%`]);
  const userIds = users.map(({ id }) => Number(id));
  if (userIds.length > 0) {
    const placeholders = userIds.map(() => '?').join(', ');
    await pool.execute(`DELETE FROM withdrawal_attempts WHERE user_id IN (${placeholders})`, userIds);
    await pool.execute(`DELETE FROM withdrawal_requests WHERE user_id IN (${placeholders})`, userIds);
    await pool.execute(`DELETE FROM notifications WHERE user_id IN (${placeholders})`, userIds);
    await pool.execute(`DELETE FROM wallet_transactions WHERE wallet_user_id IN (${placeholders})`, userIds);
    await pool.execute(`DELETE FROM wallets WHERE user_id IN (${placeholders})`, userIds);
  }
  await cleanupTestUsers(emailPrefix);
}

before(async () => {
  await prepareTestDatabase();
  await cleanupFixtures();
  admin = await createUser('admin', ['ADMIN'], 'ADMIN');
  customer = await createUser('customer', ['CUSTOMER'], 'CUSTOMER_ONLY');
  nonAdmin = await createUser('non-admin', ['CUSTOMER'], 'CUSTOMER_ONLY');
  seller = await createUser('seller', ['SELLER'], 'SELLER_ONLY');
  buyer = await createUser('buyer', ['CUSTOMER'], 'CUSTOMER_ONLY');
  withdrawalApprovalUser = await createUser('wdapprove', ['CUSTOMER'], 'CUSTOMER_ONLY');
  withdrawalRejectionUser = await createUser('wdreject', ['CUSTOMER'], 'CUSTOMER_ONLY');

  const [[game]] = await pool.execute("SELECT id FROM games WHERE status = 'ACTIVE' ORDER BY id LIMIT 1");
  assert.ok(game);
  const [moderatedProduct] = await pool.execute(
    "INSERT INTO products (seller_id, game_id, title, description, price, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')",
    [seller.id, game.id, `Moderated ${runId.slice(0, 10)}`, 'Admin moderation fixture', 100],
  );
  moderatedProductId = Number(moderatedProduct.insertId);
  const [reportedProduct] = await pool.execute(
    "INSERT INTO products (seller_id, game_id, title, description, price, status) VALUES (?, ?, ?, ?, ?, 'SOLD')",
    [seller.id, game.id, `Reported ${runId.slice(0, 10)}`, 'Transaction report fixture', 200],
  );
  reportedProductId = Number(reportedProduct.insertId);
  const [order] = await pool.execute(
    "INSERT INTO orders (product_id, buyer_id, seller_id, amount, status, completed_at) VALUES (?, ?, ?, ?, 'PAID', NULL)",
    [reportedProductId, buyer.id, seller.id, 200],
  );
  reportedOrderId = Number(order.insertId);
});

after(async () => {
  await cleanupFixtures();
  await closeTestDatabasePool();
});

test(
  'bans and restores a customer while invalidating the prior session',
  async () => {

    const nonAdminAttempt = await api
      .patch(
        `/api/v1/admin/moderation/users/${customer.id}/status`
      )
      .set(
        'Cookie',
        cookies(nonAdmin.auth)
      )
      .set(
        'X-CSRF-Token',
        csrf(nonAdmin.auth)
      )
      .send({
        status: 'BANNED',
        reason:
          'Unauthorized moderation attempt fixture.',
      });

    assert.equal(
      nonAdminAttempt.status,
      403
    );

    assert.equal(
      nonAdminAttempt.body.error.code,
      'FORBIDDEN'
    );


    const selfAttempt = await api
      .patch(
        `/api/v1/admin/moderation/users/${admin.id}/status`
      )
      .set(
        'Cookie',
        cookies(admin.auth)
      )
      .set(
        'X-CSRF-Token',
        csrf(admin.auth)
      )
      .send({
        status: 'BANNED',
        reason:
          'Self moderation is forbidden.',
      });

    assert.equal(
      selfAttempt.status,
      403
    );

    assert.equal(
      selfAttempt.body.error.code,
      'SELF_MODERATION_FORBIDDEN'
    );


    const reason =
      'Repeated policy violations.';

    const ban = await api
      .patch(
        `/api/v1/admin/moderation/users/${customer.id}/status`
      )
      .set(
        'Cookie',
        cookies(admin.auth)
      )
      .set(
        'X-CSRF-Token',
        csrf(admin.auth)
      )
      .send({
        status: 'BANNED',
        reason,
      });

    assert.equal(
      ban.status,
      200
    );

    assert.equal(
      ban.body.data.user.status,
      'BANNED'
    );


    const [[banned]] =
      await pool.execute(
        `
          SELECT
            status,
            suspension_reason,
            token_version
          FROM users
          WHERE id = ?
        `,
        [customer.id]
      );

    assert.equal(
      banned.status,
      'BANNED'
    );

    assert.equal(
      banned.suspension_reason,
      reason
    );

    assert.ok(
      Number(
        banned.token_version
      ) > 0
    );


    const staleSession =
      await api
        .get('/api/v1/auth/me')
        .set(
          'Cookie',
          cookies(customer.auth)
        );

    assert.equal(
      staleSession.status,
      401
    );

    assert.equal(
      staleSession.body.error.code,
      'INVALID_SESSION'
    );


    const restoration = await api
      .patch(
        `/api/v1/admin/moderation/users/${customer.id}/status`
      )
      .set(
        'Cookie',
        cookies(admin.auth)
      )
      .set(
        'X-CSRF-Token',
        csrf(admin.auth)
      )
      .send({
        status: 'ACTIVE',
      });

    assert.equal(
      restoration.status,
      200
    );

    assert.equal(
      restoration.body.data.user.status,
      'ACTIVE'
    );


    const [[active]] =
      await pool.execute(
        `
          SELECT
            status,
            suspension_reason,
            suspended_until
          FROM users
          WHERE id = ?
        `,
        [customer.id]
      );

    assert.equal(
      active.status,
      'ACTIVE'
    );

    assert.equal(
      active.suspension_reason,
      null
    );

    assert.equal(
      active.suspended_until,
      null
    );
  }
);

test('pauses and restores a product through the public marketplace boundary', async () => {
  const beforeModeration = await api.get(`/api/v1/products/${moderatedProductId}`);
  assert.equal(beforeModeration.status, 200);
  assert.equal(beforeModeration.body.data.status, 'ACTIVE');

  const reason = 'Listing requires additional review.';
  const pause = await api
    .patch(`/api/v1/admin/products/${moderatedProductId}/moderation`)
    .set('Cookie', cookies(admin.auth))
    .set('X-CSRF-Token', csrf(admin.auth))
    .send({ status: 'PAUSED', reason });
  assert.equal(pause.status, 200);
  assert.equal(pause.body.data.product.status, 'PAUSED');

  const [[paused]] = await pool.execute(
    'SELECT status, moderation_reason, moderated_by, moderated_at FROM products WHERE id = ?',
    [moderatedProductId],
  );
  assert.equal(paused.status, 'PAUSED');
  assert.equal(paused.moderation_reason, reason);
  assert.equal(Number(paused.moderated_by), admin.id);
  assert.ok(paused.moderated_at);

  const hiddenPublicProduct = await api.get(`/api/v1/products/${moderatedProductId}`);
  assert.equal(hiddenPublicProduct.status, 404);
  assert.equal(hiddenPublicProduct.body.error.code, 'PRODUCT_NOT_FOUND');

  const restore = await api
    .patch(`/api/v1/admin/products/${moderatedProductId}/moderation`)
    .set('Cookie', cookies(admin.auth))
    .set('X-CSRF-Token', csrf(admin.auth))
    .send({ status: 'ACTIVE' });
  assert.equal(restore.status, 200);
  assert.equal(restore.body.data.product.status, 'ACTIVE');

  const [[active]] = await pool.execute(
    'SELECT status, moderation_reason, moderated_by FROM products WHERE id = ?',
    [moderatedProductId],
  );
  assert.equal(active.status, 'ACTIVE');
  assert.equal(active.moderation_reason, null);
  assert.equal(active.moderated_by, null);

  const restoredPublicProduct = await api.get(`/api/v1/products/${moderatedProductId}`);
  assert.equal(restoredPublicProduct.status, 200);
  assert.equal(restoredPublicProduct.body.data.status, 'ACTIVE');

  const invalidState = await api
    .patch(`/api/v1/admin/products/${moderatedProductId}/moderation`)
    .set('Cookie', cookies(admin.auth))
    .set('X-CSRF-Token', csrf(admin.auth))
    .send({ status: 'SOLD' });
  assert.equal(invalidState.status, 400);
  assert.equal(invalidState.body.error.code, 'INVALID_MODERATION_STATUS');
});

test('moves an authentic transaction report from pending through review to resolution', async () => {
  const create = await api
    .post('/api/v1/transaction-reports')
    .set('Cookie', cookies(buyer.auth))
    .set('X-CSRF-Token', csrf(buyer.auth))
    .send({ orderId: reportedOrderId, reason: 'NO_DELIVERY', description: 'Transaction report lifecycle fixture.' });
  assert.equal(create.status, 201);
  transactionReportId = Number(create.body.data.report.id);
  assert.equal(create.body.data.report.status, 'PENDING');

  const pending = await api.get('/api/v1/transaction-reports/pending').set('Cookie', cookies(admin.auth));
  assert.equal(pending.status, 200);
  assert.ok(pending.body.data.reports.some((report) => Number(report.id) === transactionReportId && report.status === 'PENDING'));

  const list = await api.get('/api/v1/transaction-reports/admin').set('Cookie', cookies(admin.auth));
  assert.equal(list.status, 200);
  assert.ok(list.body.data.reports.some((report) => Number(report.id) === transactionReportId));

  const detail = await api.get(`/api/v1/transaction-reports/${transactionReportId}`).set('Cookie', cookies(admin.auth));
  assert.equal(detail.status, 200);
  assert.equal(Number(detail.body.data.report.orderId), reportedOrderId);
  assert.equal(detail.body.data.report.status, 'PENDING');

  const reviewNote = 'Review has started.';
  const reviewed = await api
    .patch(`/api/v1/transaction-reports/${transactionReportId}`)
    .set('Cookie', cookies(admin.auth))
    .set('X-CSRF-Token', csrf(admin.auth))
    .send({ status: 'REVIEWED', adminNote: reviewNote });
  assert.equal(reviewed.status, 200);
  assert.equal(reviewed.body.data.report.status, 'REVIEWED');
  assert.equal(reviewed.body.data.report.adminNote, reviewNote);

  const [[reviewedRow]] = await pool.execute(
    'SELECT status, admin_note, resolved_by, resolved_at FROM transaction_reports WHERE id = ?',
    [transactionReportId],
  );
  assert.equal(reviewedRow.status, 'REVIEWED');
  assert.equal(reviewedRow.admin_note, reviewNote);
  assert.equal(reviewedRow.resolved_by, null);
  assert.equal(reviewedRow.resolved_at, null);

  const resolutionNote = 'Case resolved after administrator review.';
  const resolved = await api
    .patch(`/api/v1/transaction-reports/${transactionReportId}`)
    .set('Cookie', cookies(admin.auth))
    .set('X-CSRF-Token', csrf(admin.auth))
    .send({ status: 'RESOLVED', adminNote: resolutionNote });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.data.report.status, 'RESOLVED');
  assert.equal(resolved.body.data.report.adminNote, resolutionNote);

  const [[resolvedRow]] = await pool.execute(
    'SELECT status, admin_note, resolved_by, resolved_at FROM transaction_reports WHERE id = ?',
    [transactionReportId],
  );
  assert.equal(resolvedRow.status, 'RESOLVED');
  assert.equal(resolvedRow.admin_note, resolutionNote);
  assert.equal(Number(resolvedRow.resolved_by), admin.id);
  assert.ok(resolvedRow.resolved_at);
});

test('removes a reported review while preserving unrelated review content', async () => {
  await pool.execute("UPDATE orders SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP(3) WHERE id = ?", [reportedOrderId]);
  const [unrelatedOrder] = await pool.execute(
    "INSERT INTO orders (product_id, buyer_id, seller_id, amount, status, completed_at) VALUES (?, ?, ?, ?, 'COMPLETED', CURRENT_TIMESTAMP(3))",
    [reportedProductId, nonAdmin.id, seller.id, 200],
  );
  unrelatedReviewOrderId = Number(unrelatedOrder.insertId);

  const targetReview = await api
    .post('/api/v1/reviews')
    .set('Cookie', cookies(buyer.auth))
    .set('X-CSRF-Token', csrf(buyer.auth))
    .send({ orderId: reportedOrderId, rating: 2, comment: 'Review report target fixture.' });
  assert.equal(targetReview.status, 201);
  targetReviewId = Number(targetReview.body.data.review.id);

  const unrelatedReview = await api
    .post('/api/v1/reviews')
    .set('Cookie', cookies(nonAdmin.auth))
    .set('X-CSRF-Token', csrf(nonAdmin.auth))
    .send({ orderId: unrelatedReviewOrderId, rating: 5, comment: 'Unrelated review fixture.' });
  assert.equal(unrelatedReview.status, 201);
  unrelatedReviewId = Number(unrelatedReview.body.data.review.id);

  const createReport = await api
    .post('/api/v1/review-reports')
    .set('Cookie', cookies(seller.auth))
    .set('X-CSRF-Token', csrf(seller.auth))
    .send({ reviewId: targetReviewId, reason: 'FRAUD', description: 'Review requires moderation.' });
  assert.equal(createReport.status, 201);
  reviewReportId = Number(createReport.body.data.report.id);
  assert.equal(createReport.body.data.report.status, 'PENDING');

  const pending = await api.get('/api/v1/review-reports/pending').set('Cookie', cookies(admin.auth));
  assert.equal(pending.status, 200);
  const pendingReport = pending.body.data.reports.find((report) => Number(report.id) === reviewReportId);
  assert.ok(pendingReport);
  assert.equal(Number(pendingReport.reviewId), targetReviewId);
  assert.equal(pendingReport.status, 'PENDING');

  const nonAdminAttempt = await api
    .patch(`/api/v1/review-reports/${reviewReportId}`)
    .set('Cookie', cookies(nonAdmin.auth))
    .set('X-CSRF-Token', csrf(nonAdmin.auth))
    .send({ action: 'REMOVED', adminNote: 'Unauthorized attempt.' });
  assert.equal(nonAdminAttempt.status, 403);
  assert.equal(nonAdminAttempt.body.error.code, 'FORBIDDEN');

  const missingCsrf = await api
    .patch(`/api/v1/review-reports/${reviewReportId}`)
    .set('Cookie', cookies(admin.auth))
    .send({ action: 'REMOVED', adminNote: 'Missing CSRF attempt.' });
  assert.equal(missingCsrf.status, 403);
  assert.equal(missingCsrf.body.error.code, 'CSRF_INVALID');

  const [[beforeResolution]] = await pool.execute(
    'SELECT status FROM review_reports WHERE id = ?',
    [reviewReportId],
  );
  const [[beforeTargetReview]] = await pool.execute('SELECT status FROM reviews WHERE id = ?', [targetReviewId]);
  assert.equal(beforeResolution.status, 'PENDING');
  assert.equal(beforeTargetReview.status, 'ACTIVE');

  const adminNote = 'Removed after review-report investigation.';
  const removed = await api
    .patch(`/api/v1/review-reports/${reviewReportId}`)
    .set('Cookie', cookies(admin.auth))
    .set('X-CSRF-Token', csrf(admin.auth))
    .send({ action: 'REMOVED', adminNote });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.report.status, 'REMOVED');
  assert.equal(removed.body.data.report.adminNote, adminNote);

  const [[resolvedReport]] = await pool.execute(
    'SELECT status, admin_note, resolved_by, resolved_at FROM review_reports WHERE id = ?',
    [reviewReportId],
  );
  assert.equal(resolvedReport.status, 'REMOVED');
  assert.equal(resolvedReport.admin_note, adminNote);
  assert.equal(Number(resolvedReport.resolved_by), admin.id);
  assert.ok(resolvedReport.resolved_at);

  const [reviews] = await pool.execute('SELECT id, status FROM reviews WHERE id IN (?, ?) ORDER BY id', [targetReviewId, unrelatedReviewId]);
  const statusById = new Map(reviews.map((review) => [Number(review.id), review.status]));
  assert.equal(statusById.get(targetReviewId), 'HIDDEN');
  assert.equal(statusById.get(unrelatedReviewId), 'ACTIVE');

  const visibleReviews = await api.get(`/api/v1/reviews/products/${reportedProductId}`);
  assert.equal(visibleReviews.status, 200);
  assert.ok(!visibleReviews.body.data.reviews.some((review) => Number(review.id) === targetReviewId));
  assert.ok(visibleReviews.body.data.reviews.some((review) => Number(review.id) === unrelatedReviewId));

  const duplicateResolution = await api
    .patch(`/api/v1/review-reports/${reviewReportId}`)
    .set('Cookie', cookies(admin.auth))
    .set('X-CSRF-Token', csrf(admin.auth))
    .send({ action: 'REMOVED', adminNote: 'Duplicate resolution attempt.' });
  assert.equal(duplicateResolution.status, 409);
  assert.equal(duplicateResolution.body.error.code, 'REPORT_ALREADY_RESOLVED');

  const [[afterDuplicateReport]] = await pool.execute('SELECT status FROM review_reports WHERE id = ?', [reviewReportId]);
  const [[afterDuplicateReview]] = await pool.execute('SELECT status FROM reviews WHERE id = ?', [targetReviewId]);
  assert.equal(afterDuplicateReport.status, 'REMOVED');
  assert.equal(afterDuplicateReview.status, 'HIDDEN');
});

test('approves an authentic reserved withdrawal without deducting the wallet twice', async () => {
  const startingBalance = 1000;
  const withdrawalAmount = 250;
  await walletRepository.ensureWallet(withdrawalApprovalUser.id);
  await pool.execute('UPDATE wallets SET balance = ? WHERE user_id = ?', [startingBalance, withdrawalApprovalUser.id]);

  const request = await withdrawalService.createRequest(withdrawalApprovalUser.id, {
    amount: withdrawalAmount,
    paymentMethod: 'BANK',
    bankCode: 'KBANK',
    accountName: 'Withdrawal Approval Fixture',
    accountNumber: '1234567890',
  });
  approvalWithdrawalId = request.id;
  assert.equal(request.status, 'PENDING');

  const walletAfterReservation = await walletRepository.findByUserId(withdrawalApprovalUser.id);
  assert.equal(walletAfterReservation.balance, startingBalance - withdrawalAmount);
  const [reservationLedger] = await pool.execute(
    "SELECT type, amount, balance_after FROM wallet_transactions WHERE wallet_user_id = ? AND reference_type = 'WITHDRAWAL_REQUEST' AND reference_id = ? ORDER BY id",
    [withdrawalApprovalUser.id, approvalWithdrawalId],
  );
  assert.deepEqual(reservationLedger.map((entry) => [entry.type, Number(entry.amount), Number(entry.balance_after)]), [
    ['WITHDRAWAL', -withdrawalAmount, startingBalance - withdrawalAmount],
  ]);

  const pending = await api.get('/api/v1/admin/wallet/withdrawal/pending').set('Cookie', cookies(admin.auth));
  assert.equal(pending.status, 200);
  assert.ok(
    pending.body.data.requests.some(
      (item) =>
        Number(item.id) === approvalWithdrawalId &&
        item.status === 'PENDING' &&
        item.bankCode === 'KBANK'
    )
  );

  const nonAdminAttempt = await api
    .post(`/api/v1/admin/wallet/withdrawal/${approvalWithdrawalId}/approve`)
    .set('Cookie', cookies(nonAdmin.auth))
    .set('X-CSRF-Token', csrf(nonAdmin.auth));
  assert.equal(nonAdminAttempt.status, 403);
  assert.equal(nonAdminAttempt.body.error.code, 'FORBIDDEN');

  const missingCsrf = await api
    .post(`/api/v1/admin/wallet/withdrawal/${approvalWithdrawalId}/approve`)
    .set('Cookie', cookies(admin.auth));
  assert.equal(missingCsrf.status, 403);
  assert.equal(missingCsrf.body.error.code, 'CSRF_INVALID');

  const approval = await api
    .post(`/api/v1/admin/wallet/withdrawal/${approvalWithdrawalId}/approve`)
    .set('Cookie', cookies(admin.auth))
    .set('X-CSRF-Token', csrf(admin.auth));
  assert.equal(approval.status, 200);
  assert.deepEqual(approval.body.data.request, { id: approvalWithdrawalId, status: 'APPROVED' });

  const [[approvedRequest]] = await pool.execute(
    'SELECT status, rejection_reason, reviewed_by, reviewed_at FROM withdrawal_requests WHERE id = ?',
    [approvalWithdrawalId],
  );
  assert.equal(approvedRequest.status, 'APPROVED');
  assert.equal(approvedRequest.rejection_reason, null);
  assert.equal(Number(approvedRequest.reviewed_by), admin.id);
  assert.ok(approvedRequest.reviewed_at);

  const walletAfterApproval = await walletRepository.findByUserId(withdrawalApprovalUser.id);
  assert.equal(walletAfterApproval.balance, startingBalance - withdrawalAmount);
  const [ledgerAfterApproval] = await pool.execute(
    "SELECT type, amount, balance_after FROM wallet_transactions WHERE wallet_user_id = ? AND reference_type = 'WITHDRAWAL_REQUEST' AND reference_id = ? ORDER BY id",
    [withdrawalApprovalUser.id, approvalWithdrawalId],
  );
  assert.deepEqual(ledgerAfterApproval.map((entry) => [entry.type, Number(entry.amount), Number(entry.balance_after)]), [
    ['WITHDRAWAL', -withdrawalAmount, startingBalance - withdrawalAmount],
  ]);

  const [[approvalNotifications]] = await pool.execute(
    "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND type = 'WALLET_WITHDRAW_APPROVED' AND reference_type = 'WITHDRAWAL' AND reference_id = ?",
    [withdrawalApprovalUser.id, approvalWithdrawalId],
  );
  assert.equal(Number(approvalNotifications.count), 1);

  const duplicateApproval = await api
    .post(`/api/v1/admin/wallet/withdrawal/${approvalWithdrawalId}/approve`)
    .set('Cookie', cookies(admin.auth))
    .set('X-CSRF-Token', csrf(admin.auth));
  assert.equal(duplicateApproval.status, 409);
  assert.equal(duplicateApproval.body.error.code, 'WITHDRAWAL_ALREADY_PROCESSED');

  const walletAfterDuplicate = await walletRepository.findByUserId(withdrawalApprovalUser.id);
  assert.equal(walletAfterDuplicate.balance, startingBalance - withdrawalAmount);
  const [[approvalLedgerCount]] = await pool.execute(
    "SELECT COUNT(*) AS count FROM wallet_transactions WHERE wallet_user_id = ? AND reference_type = 'WITHDRAWAL_REQUEST' AND reference_id = ?",
    [withdrawalApprovalUser.id, approvalWithdrawalId],
  );
  const [[approvalNotificationCount]] = await pool.execute(
    "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND reference_type = 'WITHDRAWAL' AND reference_id = ?",
    [withdrawalApprovalUser.id, approvalWithdrawalId],
  );
  assert.equal(Number(approvalLedgerCount.count), 1);
  assert.equal(Number(approvalNotificationCount.count), 1);
});

test('rejects an authentic reserved withdrawal and refunds the wallet exactly once', async () => {
  const startingBalance = 1000;
  const withdrawalAmount = 300;
  await walletRepository.ensureWallet(withdrawalRejectionUser.id);
  await pool.execute('UPDATE wallets SET balance = ? WHERE user_id = ?', [startingBalance, withdrawalRejectionUser.id]);

  const request = await withdrawalService.createRequest(withdrawalRejectionUser.id, {
    amount: withdrawalAmount,
    paymentMethod: 'PROMPTPAY',
    accountName: 'Withdrawal Rejection Fixture',
    accountNumber: '0812345678',
  });
  rejectionWithdrawalId = request.id;
  assert.equal(request.status, 'PENDING');

  const walletAfterReservation = await walletRepository.findByUserId(withdrawalRejectionUser.id);
  assert.equal(walletAfterReservation.balance, startingBalance - withdrawalAmount);

  const nonAdminAttempt = await api
    .post(`/api/v1/admin/wallet/withdrawal/${rejectionWithdrawalId}/reject`)
    .set('Cookie', cookies(nonAdmin.auth))
    .set('X-CSRF-Token', csrf(nonAdmin.auth))
    .send({ reason: 'Unauthorized rejection attempt.' });
  assert.equal(nonAdminAttempt.status, 403);
  assert.equal(nonAdminAttempt.body.error.code, 'FORBIDDEN');

  const missingCsrf = await api
    .post(`/api/v1/admin/wallet/withdrawal/${rejectionWithdrawalId}/reject`)
    .set('Cookie', cookies(admin.auth))
    .send({ reason: 'Missing CSRF attempt.' });
  assert.equal(missingCsrf.status, 403);
  assert.equal(missingCsrf.body.error.code, 'CSRF_INVALID');

  const reason = 'Account details could not be verified.';
  const rejection = await api
    .post(`/api/v1/admin/wallet/withdrawal/${rejectionWithdrawalId}/reject`)
    .set('Cookie', cookies(admin.auth))
    .set('X-CSRF-Token', csrf(admin.auth))
    .send({ reason });
  assert.equal(rejection.status, 200);
  assert.deepEqual(rejection.body.data.request, { id: rejectionWithdrawalId, status: 'REJECTED' });

  const [[rejectedRequest]] = await pool.execute(
    'SELECT status, rejection_reason, reviewed_by, reviewed_at FROM withdrawal_requests WHERE id = ?',
    [rejectionWithdrawalId],
  );
  assert.equal(rejectedRequest.status, 'REJECTED');
  assert.equal(rejectedRequest.rejection_reason, reason);
  assert.equal(Number(rejectedRequest.reviewed_by), admin.id);
  assert.ok(rejectedRequest.reviewed_at);

  const walletAfterRejection = await walletRepository.findByUserId(withdrawalRejectionUser.id);
  assert.equal(walletAfterRejection.balance, startingBalance);
  const [ledgerAfterRejection] = await pool.execute(
    "SELECT type, amount, balance_after FROM wallet_transactions WHERE wallet_user_id = ? AND reference_type = 'WITHDRAWAL_REQUEST' AND reference_id = ? ORDER BY id",
    [withdrawalRejectionUser.id, rejectionWithdrawalId],
  );
  assert.deepEqual(ledgerAfterRejection.map((entry) => [entry.type, Number(entry.amount), Number(entry.balance_after)]), [
    ['WITHDRAWAL', -withdrawalAmount, startingBalance - withdrawalAmount],
    ['REFUND', withdrawalAmount, startingBalance],
  ]);

  const [[refundCount]] = await pool.execute(
    "SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount FROM wallet_transactions WHERE wallet_user_id = ? AND reference_type = 'WITHDRAWAL_REQUEST' AND reference_id = ? AND type = 'REFUND'",
    [withdrawalRejectionUser.id, rejectionWithdrawalId],
  );
  assert.equal(Number(refundCount.count), 1);
  assert.equal(Number(refundCount.amount), withdrawalAmount);

  const [[rejectionNotifications]] = await pool.execute(
    "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND type = 'WALLET_WITHDRAW_REJECTED' AND reference_type = 'WITHDRAWAL' AND reference_id = ?",
    [withdrawalRejectionUser.id, rejectionWithdrawalId],
  );
  assert.equal(Number(rejectionNotifications.count), 1);

  const duplicateRejection = await api
    .post(`/api/v1/admin/wallet/withdrawal/${rejectionWithdrawalId}/reject`)
    .set('Cookie', cookies(admin.auth))
    .set('X-CSRF-Token', csrf(admin.auth))
    .send({ reason: 'Duplicate rejection attempt.' });
  assert.equal(duplicateRejection.status, 409);
  assert.equal(duplicateRejection.body.error.code, 'WITHDRAWAL_ALREADY_PROCESSED');

  const walletAfterDuplicate = await walletRepository.findByUserId(withdrawalRejectionUser.id);
  assert.equal(walletAfterDuplicate.balance, startingBalance);
  const [[refundAfterDuplicate]] = await pool.execute(
    "SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount FROM wallet_transactions WHERE wallet_user_id = ? AND reference_type = 'WITHDRAWAL_REQUEST' AND reference_id = ? AND type = 'REFUND'",
    [withdrawalRejectionUser.id, rejectionWithdrawalId],
  );
  const [[notificationAfterDuplicate]] = await pool.execute(
    "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND reference_type = 'WITHDRAWAL' AND reference_id = ?",
    [withdrawalRejectionUser.id, rejectionWithdrawalId],
  );
  const [[stateAfterDuplicate]] = await pool.execute('SELECT status FROM withdrawal_requests WHERE id = ?', [rejectionWithdrawalId]);
  assert.equal(Number(refundAfterDuplicate.count), 1);
  assert.equal(Number(refundAfterDuplicate.amount), withdrawalAmount);
  assert.equal(Number(notificationAfterDuplicate.count), 1);
  assert.equal(stateAfterDuplicate.status, 'REJECTED');
});
