"use strict";

const userService = require("../services/user.service");
const { success } = require("../utils/response");
const asyncHandler = require("../utils/async-handler");

const updateUsername = asyncHandler(async (req, res) => {
  const user = await userService.updateUsername(req.user.id, req.validatedBody.newUsername);
  return success(res, 200, { user });
});

const updateEmail = asyncHandler(async (req, res) => {
  const user = await userService.updateEmail(req.user.id, req.validatedBody.newEmail);
  return success(res, 200, { user });
});

module.exports = { updateUsername, updateEmail };
