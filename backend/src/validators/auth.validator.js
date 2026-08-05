const { z } = require('zod');

const email = z.string().trim().toLowerCase().email('Email is invalid.').max(254);
const username = z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_]+$/, 'Username may contain only letters, numbers, and underscores.');
const password = z.string().min(8, 'Password must be at least 8 characters.').max(72, 'Password must be 72 characters or fewer.').regex(/[a-z]/, 'Password must include a lowercase letter.').regex(/[A-Z]/, 'Password must include an uppercase letter.').regex(/[0-9]/, 'Password must include a number.');

const registerSchema = z.object({ email, username, password, accountType: z.enum(['CUSTOMER', 'SELLER']).optional() });
const loginSchema = z.object({ emailOrUsername: z.string().trim().min(3).max(254), password: z.string().min(1).max(72) });
const forgotPasswordSchema = z.object({ email });
const resetPasswordSchema = z.object({ token: z.string().min(32).max(256), newPassword: password });
const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(72), newPassword: password });

module.exports = { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema };
