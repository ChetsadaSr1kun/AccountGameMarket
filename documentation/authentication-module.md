# Authentication Module

This module implements registration, login, JWT access tokens, rotating refresh tokens, logout, password reset, roles, validation, rate limiting, CORS, cookies, and MySQL migrations.

## Setup

1. Copy `.env.example` to `.env` and fill the MySQL and JWT values.
2. Create the `gamemarket` MySQL database and a least-privileged `gamemarket_app` account.
3. Run `npm.cmd run db:migrate`.
4. Set the `ADMIN_*` values in `.env` and run `npm.cmd run db:create-admin` once.
5. Run `npm.cmd run dev`.

## Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/auth/register` | Register a Customer/Seller account based on `ACCOUNT_MODE` |
| `POST /api/v1/auth/login` | Login and set access/refresh cookies |
| `POST /api/v1/auth/refresh` | Rotate the refresh token and issue a fresh access token |
| `POST /api/v1/auth/logout` | Revoke the current refresh token |
| `POST /api/v1/auth/logout-all` | Revoke all user sessions |
| `GET /api/v1/auth/me` | Return authenticated user data and roles |
| `POST /api/v1/auth/forgot-password` | Create a single-use password reset token |
| `POST /api/v1/auth/reset-password` | Reset a password and revoke all sessions |
| `POST /api/v1/auth/change-password` | Change password while logged in |

## Current email behavior

For local development, reset links are written to the terminal. A real email provider will be added later; no email API key is required for this module.
