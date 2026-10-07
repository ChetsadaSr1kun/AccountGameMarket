const express =
  require('express');

const controller =
  require(
    '../controllers/support-chat.controller'
  );

const {
  authenticate,
  authorize,
} =
  require(
    '../middleware/auth.middleware'
  );

const { requireCsrf } =
  require(
    '../middleware/csrf.middleware'
  );


const router = express.Router();

router.use(authenticate);


/*
 * User Support
 */

router.get(
  '/me/unread',
  authorize('CUSTOMER', 'SELLER'),
  controller.getUserUnreadCount
);

router.get(
  '/me',
  authorize('CUSTOMER', 'SELLER'),
  controller.getUserSupport
);

router.post(
  '/me/messages',
  authorize('CUSTOMER', 'SELLER'),
  requireCsrf,
  controller.sendUserMessage
);


/*
 * Admin Support Inbox
 */

router.get(
  '/admin',
  authorize('ADMIN'),
  controller.listAdminSupport
);

router.get(
  '/admin/:conversationId',
  authorize('ADMIN'),
  controller.getAdminSupport
);

router.post(
  '/admin/:conversationId/messages',
  authorize('ADMIN'),
  requireCsrf,
  controller.sendAdminMessage
);


module.exports = router;