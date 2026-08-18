"use strict";

const userRepository = require("../repositories/user.repository");
const { withTransaction } = require("../utils/transaction");
const AppError = require("../utils/app-error");

/**
 * Returns the profile fields safe to send to the client.
 * Mirrors auth.service.publicUser so the shape is consistent.
 */
function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    roles: user.roles,
    accountMode: user.accountMode,
    status: user.status,
  };
}

async function updateUsername(userId, newUsername) {
  // Reject if the same as current
  const currentUser = await userRepository.findAuthUserById(userId);
  if (currentUser && currentUser.username === newUsername) {
    throw new AppError("New username must differ from the current one.", 422, "VALIDATION_ERROR");
  }

  // Check duplicate
  const existing = await userRepository.findByUsername(newUsername);
  if (existing) {
    throw new AppError("Username is already in use.", 409, "DUPLICATE_USERNAME");
  }

  await withTransaction(async (connection) => {
    await userRepository.updateUsername(connection, userId, newUsername);
  });

  // Re-fetch so the returned user has roles and all fields
  const updated = await userRepository.findAuthUserById(userId);
  return publicUser(updated);
}

async function updateEmail(userId, newEmail) {
  // Reject if the same as current
  const currentUser = await userRepository.findAuthUserById(userId);
  if (currentUser && currentUser.email === newEmail) {
    throw new AppError("New email must differ from the current one.", 422, "VALIDATION_ERROR");
  }

  // Check duplicate
  const existing = await userRepository.findByEmail(newEmail);
  if (existing && existing.id !== userId) {
    throw new AppError("Email is already in use.", 409, "DUPLICATE_EMAIL");
  }

  await withTransaction(async (connection) => {
    await userRepository.updateEmail(connection, userId, newEmail);
  });

  const updated = await userRepository.findAuthUserById(userId);
  return publicUser(updated);
}

module.exports = { updateUsername, updateEmail };
