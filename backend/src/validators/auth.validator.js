const { z } = require('zod');

const email = z.string().trim().toLowerCase().email('Email is invalid.').max(254);
const username = z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_]+$/, 'Username may contain only letters, numbers, and underscores.');
const password = z.string().min(8, 'Password must be at least 8 characters.').max(72, 'Password must be 72 characters or fewer.').regex(/[a-z]/, 'Password must include a lowercase letter.').regex(/[A-Z]/, 'Password must include an uppercase letter.').regex(/[0-9]/, 'Password must include a number.');
const name = z.string().trim().min(1, 'Name is required.').max(100, 'Name must be 100 characters or fewer.');
const phone = z.string().trim().min(1, 'Phone is required.').max(32, 'Phone must be 32 characters or fewer.').regex(/^\+?[0-9][0-9\s()-]{7,31}$/, 'Phone number is invalid.');
const dateOfBirth = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must use YYYY-MM-DD.').refine((value) => {
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}, 'Date of birth is invalid.').refine((value) => value <= new Date().toISOString().slice(0, 10), 'Date of birth cannot be in the future.');

const registerSchema = z.object({ email, username, password, firstName: name, lastName: name, phone, dateOfBirth, accountType: z.enum(['CUSTOMER', 'SELLER']).optional() });
const loginSchema = z.object({ emailOrUsername: z.string().trim().min(3).max(254), password: z.string().min(1).max(72) });
const forgotPasswordSchema = z.object({ email });
const resetPasswordSchema = z.object({ token: z.string().min(32).max(256), newPassword: password });
const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(72), newPassword: password });

module.exports = { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema };
