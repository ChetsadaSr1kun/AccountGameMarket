"use strict";

const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const userRepository = require("../repositories/user.repository");
const verificationOtpRepository = require("../repositories/user-verification-otp.repository");
const { withTransaction } = require("../utils/transaction");
const AppError = require("../utils/app-error");

const avatarDirectory = path.resolve(__dirname, "../../..", "uploads", "avatars");
const avatarUrlPrefix = "/uploads/avatars/";
const avatarUrlPattern = /^\/uploads\/avatars\/avatar-[a-f0-9-]{36}\.(jpg|png|webp)$/;

/**
 * Returns the profile fields safe to send to the client.
 * Mirrors auth.service.publicUser so the shape is consistent.
 */
function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    dateOfBirth: user.dateOfBirth,
    avatarUrl: user.avatarUrl,
    emailVerified: Boolean(user.emailVerifiedAt),
    phoneVerified: Boolean(user.phoneVerifiedAt),
    accountVerified: Boolean(user.emailVerifiedAt && user.phoneVerifiedAt),
    roles: user.roles,
    accountMode: user.accountMode,
    status: user.status,
  };
}

function detectAvatarExtension(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

function managedAvatarPath(avatarUrl) {
  if (typeof avatarUrl !== "string" || !avatarUrlPattern.test(avatarUrl)) return null;
  return path.join(avatarDirectory, path.basename(avatarUrl));
}

async function removeFileIfPresent(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
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
    await verificationOtpRepository.invalidateActiveForUserChannel(connection, userId, 'EMAIL');
  });

  const updated = await userRepository.findAuthUserById(userId);
  return publicUser(updated);
}

async function updateAvatar(userId, file) {
  const extension = detectAvatarExtension(file.buffer);
  if (!extension) throw new AppError("Avatar file content is not a supported image.", 422, "INVALID_AVATAR_FILE_TYPE");

  const filename = `avatar-${crypto.randomUUID()}.${extension}`;
  const avatarUrl = `${avatarUrlPrefix}${filename}`;
  const newAvatarPath = path.join(avatarDirectory, filename);

  await fs.mkdir(avatarDirectory, { recursive: true });
  await fs.writeFile(newAvatarPath, file.buffer, { flag: "wx" });

  let previousAvatarUrl = null;
  try {
    await withTransaction(async (connection) => {
      const currentUser = await userRepository.findAuthUserById(userId, connection);
      if (!currentUser) throw new AppError("User not found.", 404, "USER_NOT_FOUND");
      previousAvatarUrl = currentUser.avatarUrl;
      await userRepository.updateAvatarUrl(connection, userId, avatarUrl);
    });
  } catch (error) {
    await removeFileIfPresent(newAvatarPath);
    throw error;
  }

  const updatedUser = await userRepository.findAuthUserById(userId);
  const previousAvatarPath = managedAvatarPath(previousAvatarUrl);
  if (previousAvatarPath && previousAvatarUrl !== avatarUrl) {
    try {
      await removeFileIfPresent(previousAvatarPath);
    } catch (error) {
      // The new avatar is already committed; retain it even if stale-file cleanup fails.
    }
  }

  return publicUser(updatedUser);
}

module.exports = { publicUser, updateUsername, updateEmail, updateAvatar };
