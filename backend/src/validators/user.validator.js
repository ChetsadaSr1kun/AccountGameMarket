const { z } = require("zod");

const newUsername = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(30, "Username must be 30 characters or fewer.")
  .regex(/^[A-Za-z0-9_]+$/, "Username may contain only letters, numbers, and underscores.");

const newEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email is invalid.")
  .max(254, "Email must be 254 characters or fewer.");

const updateUsernameSchema = z.object({ newUsername });
const updateEmailSchema = z.object({ newEmail });

module.exports = { updateUsernameSchema, updateEmailSchema };
