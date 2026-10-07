const service =
  require(
    '../services/support-chat.service'
  );

const asyncHandler =
  require('../utils/async-handler');

const { success } =
  require('../utils/response');


const getUserSupport =
  asyncHandler(
    async (req, res) => {
      const data =
        await service.getUserSupport(
          req.user.id
        );

      return success(
        res,
        200,
        data
      );
    }
  );


const sendUserMessage =
  asyncHandler(
    async (req, res) => {
      const message =
        await service.sendUserMessage(
          req.user.id,
          req.body?.body
        );

      return success(
        res,
        201,
        { message }
      );
    }
  );


const getUserUnreadCount =
  asyncHandler(
    async (req, res) => {
      const unreadCount =
        await service
          .getUserUnreadCount(
            req.user.id
          );

      return success(
        res,
        200,
        { unreadCount }
      );
    }
  );


const listAdminSupport =
  asyncHandler(
    async (req, res) => {
      const conversations =
        await service
          .listAdminSupport();

      return success(
        res,
        200,
        { conversations }
      );
    }
  );


const getAdminSupport =
  asyncHandler(
    async (req, res) => {
      const data =
        await service.getAdminSupport(
          req.params.conversationId
        );

      return success(
        res,
        200,
        data
      );
    }
  );


const sendAdminMessage =
  asyncHandler(
    async (req, res) => {
      const message =
        await service.sendAdminMessage(
          req.user.id,
          req.params.conversationId,
          req.body?.body
        );

      return success(
        res,
        201,
        { message }
      );
    }
  );


module.exports = {
  getUserSupport,
  sendUserMessage,
  getUserUnreadCount,

  listAdminSupport,
  getAdminSupport,
  sendAdminMessage,
};