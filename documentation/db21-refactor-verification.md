# GameMarket: database refactor verification

Verified on 2026-10-08 on `refactor/db-21-tables`.

The application database has **exactly 21 base tables**. All 26 test files pass:
196 tests in `npm test` plus 28 tests in the additional suite, with zero failures
and zero skipped tests. The same suites pass on a newly created database.

The frontend, routes and controllers were not redesigned or changed for storage
compatibility. Existing repository/service response shapes and public IDs are
preserved. The development server was restarted after verification; health and
Product 19 HTTP requests returned 200 at `http://localhost:3000`.

## 1. Migration inventory

All files below are in `database/migrations/`. Additive/copy and DROP operations
are separate files. Existing 043/044 were validated on continuation, not recreated
or reapplied.

| Storage change | Additive migration | Separate DROP migration |
| --- | --- | --- |
| Valorant verification into products | `033_merge_valorant_verification_into_products.sql` | `034_drop_product_valorant_verifications.sql` |
| Seller documents into requests | `035_merge_seller_documents_into_requests.sql` | `036_drop_seller_verification_documents.sql` |
| Roles derived from account mode | `037_preserve_account_role_assignments.sql` | `038_drop_role_tables.sql` |
| Wallet balance into users | `039_merge_wallets_into_users.sql` | `040_drop_wallets.sql` |
| Shared chat storage | `041_merge_support_chat.sql` | `042_drop_support_chat_tables.sql` |
| Shared report storage | `043_merge_reports.sql` | `044_drop_old_report_tables.sql` |
| Shared withdrawal storage | `045_merge_withdrawals.sql` | `046_drop_old_withdrawal_tables.sql` |

Fresh database: `gamemarket_db21_test_fresh_20261008_final`. It did not exist before
verification. All **45 SQL files present in the repository**, from 001 through
046, applied successfully; the migration ledger exactly matches that file list
and `SHOW TABLES` returns 21 tables. No database was dropped or truncated.

Historical limitation: the repository already had no migration 026, while the
application database records `026_set_game_image_urls.sql`. No copy exists in
local Git history. Its original SQL was not reconstructed or claimed as tested.
The successful fresh run covers every SQL file actually shipped in the repository.

## 2. Removed tables

`product_valorant_verifications`, `seller_verification_documents`, `roles`,
`user_roles`, `wallets`, `support_conversations`, `support_messages`,
`review_reports`, `transaction_reports`, `withdrawal_attempts`,
`withdrawal_requests`.

The new `reports` and `withdrawals` tables account for the net reduction from
30 original tables to 21. At the start of the latest continuation there were
22 tables, and Phase 5 storage migration was already applied.

## 3. Final 21 tables

1. users
2. games
3. products
4. product_credentials
5. product_images
6. orders
7. conversations
8. messages
9. conversation_read_states
10. notifications
11. reviews
12. reports
13. seller_verification_requests
14. refresh_tokens
15. password_reset_tokens
16. user_verification_otps
17. wallet_topup_requests
18. wallet_transactions
19. withdrawals
20. withdrawal_attempt_otps
21. schema_migrations

## 4. Important implementation changes

Paths in this section are relative to `backend/src/`.

- Valorant: `repositories/valorant-verification.repository.js`,
  `product.repository.js`, `public-product-list.repository.js` and
  `seller-profile.repository.js` read product columns. Public projections return
  the verification flag without Riot identifiers.
- Seller verification: `repositories/seller-verification.repository.js` stores
  each of ID_FRONT, ID_BACK and SELFIE in typed columns, preserving document IDs,
  metadata and `documents: [...]` responses.
- Roles: `utils/account-roles.js`, user repository, auth/seller verification/admin
  user services and `scripts/create-admin.js` derive server roles from account
  mode. Old assignment timestamps remain represented in users. The role repository
  was removed; `req.user.roles` remains available.
- Wallet: `repositories/wallet.repository.js`, order/top-up/withdrawal/admin wallet
  services use `users.wallet_balance` with DECIMAL SQL arithmetic, conditional
  debits and transaction locks. Wallet ledger remains separate.
- Chat: `repositories/chat-storage.js`, `chat.repository.js`,
  `support-chat.repository.js` and home queries isolate USER/SUPPORT records and
  translate legacy support IDs. Existing participants, assignments, status,
  timestamps and read markers remain represented.
- Reports: `repositories/report-storage.js`, review/transaction report
  repositories, game/order queries and admin product counts use typed projections.
  Explicit review/order foreign keys, duplicate constraints and legacy IDs are
  preserved. Internal type/source fields are excluded from API projections.
- Withdrawals: `repositories/withdrawal-storage.js`, withdrawal/attempt/wallet/game
  repositories and withdrawal/attempt/admin wallet/admin user services use typed
  storage. Attempt IDs remain unchanged; request IDs use `legacy_request_id`
  where needed. Locking reads target the base table directly with `FOR UPDATE`.

Historical withdrawal records are **22 ATTEMPT rows plus 13 REQUEST rows**, not
guessed pairs. The old schema had no link between attempts and requests. New
requests have a unique server-supplied source attempt relation; historical requests
retain a NULL relation. OTP composite foreign keys only accept ATTEMPT rows.

An existing OTP issue was reproduced by new tests: throwing inside the transaction
rolled back failed-attempt counters and expiry invalidation. Verification now
commits those security updates before throwing the existing API error. The fifth
incorrect email OTP invalidates the record. Error codes/messages, hashing, expiry
durations, provider verification and frontend flow remain unchanged.

## 5. Tests and commands

`node --check` passed for existing changed JS files across the refactor (54 changed
paths were enumerated, including the removed role repository). `git diff --check`
passed for the working diff and the complete refactor diff from `e2b3ac6`.

Phase 5 continuation targeted command:

```powershell
node --require ./test/helpers/test-environment.js --test --test-concurrency=1 test/marketplace/report-storage.integration.test.js test/marketplace/review-report.chat-review.integration.test.js test/marketplace/transaction-report.chat-review.integration.test.js test/marketplace/transaction-report.user-flow.integration.test.js test/admin/admin-critical-flow.integration.test.js
```

Main command: `npm test`. Its 18 files are:

- `test/auth/auth.integration.test.js`
- `test/user/user.integration.test.js`
- `test/marketplace/marketplace.foundation.integration.test.js`
- `test/marketplace/product.api.integration.test.js`
- `test/marketplace/order-purchase.integration.test.js`
- `test/marketplace/game-admin.integration.test.js`
- `test/marketplace/transaction-report.security.integration.test.js`
- `test/marketplace/transaction-report.user-flow.integration.test.js`
- `test/admin/admin-critical-flow.integration.test.js`
- `test/wallet/wallet-topup.integration.test.js`
- `test/wallet/payment-method-allowlist.integration.test.js`
- `test/seller-verification/seller-verification.integration.test.js`
- `test/services/slipok.service.test.js`
- `test/middleware/rate-limit.integration.test.js`
- `test/frontend/avatar-confirmation.contract.test.js`
- `test/frontend/phone-format.test.js`
- `test/frontend/wallet-withdraw.contract.test.js`
- `test/services/sms.service.test.js`

Additional suite, covering every test file omitted by `npm test`:

```powershell
node --require ./test/helpers/test-environment.js --test --test-concurrency=1 test/frontend/seller-rating.contract.test.js test/marketplace/marketplace-vat.test.js test/marketplace/review-report.chat-review.integration.test.js test/marketplace/transaction-report.chat-review.integration.test.js test/wallet/wallet-atomic.integration.test.js test/marketplace/chat-storage.integration.test.js test/marketplace/report-storage.integration.test.js test/wallet/withdrawal-storage.integration.test.js
```

The fresh run uses the same commands with this process-only override:

```powershell
$env:GAMEMARKET_TEST_DB='gamemarket_db21_test_fresh_20261008_final'
```

Test helpers permit only the dedicated DB name/prefix and set a high initial user
ID range on new test databases to avoid overlapping live seller-document folders.
`.env` and `.env.test` were not edited. Email/SMS providers are mocked or disabled
in tests; no real OTP delivery is claimed by these tests.

## 6. Results

| Verification | Result |
| --- | --- |
| Phase 5 continuation targeted tests | 21/21 |
| Phase 5 main + additional tests | 196/196 + 20/20 |
| Phase 6 targeted withdrawal/admin/wallet/frontend tests | 26/26 before adding the extra phone-expiry case |
| Phase 6 before DROP, main + all additional tests | 196/196 + 28/28 |
| Phase 6 after DROP, main + all additional tests | 196/196 + 28/28 |
| Fresh database main + all additional tests | 196/196 + 28/28 |
| All repository migrations on fresh DB | 45/45, 21 tables |
| Syntax, whitespace and dropped-table runtime search | Passed |

No assertion was weakened and no test was skipped. The pre-existing seller-rating
test referenced a removed frontend script; it was repaired to exercise the current
profile code without modifying frontend behavior.

Local logs, response hashes and the integrity baseline are ignored under
`tmp/db21/`; they are not committed. The baseline stores counts, column names and
SHA-256 digests, not source rows or secrets.

## 7. Data integrity

`node scripts/db21-integrity.js verify` reconstructs the original logical tables
and compares their counts and every original column against the baseline captured
at 29 tables with writes stopped. Final verification passed for all 28 logical
data tables (migration bookkeeping excluded). It is not a claim that the external
full SQL backup was restored or compared byte for byte.

| Logical data | Before and after |
| --- | --- |
| Users / products / orders / reviews | 21 / 18 / 14 / 6 |
| Marketplace conversations / messages / read states | 4 / 25 / 8 |
| Support conversations / messages | 2 / 15 |
| Shared conversations / messages after merge | 6 / 40 |
| Notifications | 52 |
| Existing wallets / wallet transactions | 12 / 59 |
| Wallet top-up requests | 77 |
| Seller requests / documents | 5 / 15 (5 of each document type) |
| Review reports / transaction reports | 2 / 6, total 8 |
| Withdrawal attempts / requests / OTP rows | 22 / 13 / 29 |
| Refresh tokens / password reset tokens / account OTPs | 598 / 14 / 56 |
| Product credentials / images / games | 18 / 43 / 6 |

All existing wallet balances, wallet timestamps and ledger columns match exactly;
no ledger entry was added or removed by migration. Original users without wallets
retain the default zero balance until wallet initialization. Matching all request
and ledger fields also preserves the original top-up/withdrawal/purchase/sale/refund
totals.

Withdrawal request history retains 6 pending (650.00), 5 approved (1400.00) and
2 rejected (200.00). Attempts retain 12 pending (1200.00) and 10 completed (1050.00).
There are zero orphan withdrawal OTPs. Migration 046 checks original source rows,
all fields, counts and OTP relations before either DROP.

All 15 seller document files exist; file size and SHA-256 match their stored
metadata. No original document was deleted. Report lists/details and withdrawal
admin lists/history/summary, user history and attempt results have identical
pre/post response hashes. Support records and read markers match the baseline;
chat isolation, ordering and unread behavior also pass integration tests.

Product 19 remains Verified in backend, My Products, public listings and seller
profile. Original product columns, including verification metadata, match the
baseline, preserving the verified-product set.

## 8. Security and compatibility checks

- Server roles: ADMIN, CUSTOMER_ONLY, UNIFIED and SELLER_ONLY map on the server;
  unknown account modes fail closed. Login, refresh/revocation, protected routes
  and seller approval are exercised by the test suites.
- CSRF, ownership and admin authorization assertions remain enabled. Tests cover
  report chat access, support isolation and withdrawal user/admin boundaries.
- Password, product credential and OTP hashing/encryption formats were not changed.
  Sensitive stored columns match the baseline; secure token/OTP/ledger tables remain
  separate.
- Withdrawal tests cover colliding IDs, wrong-type foreign keys, duplicate requests,
  concurrent completion, concurrent rejection, exact decimal balances, insufficient
  funds rollback, rollback after duplicate insertion, OTP order/cooldown/expiry/
  reuse/failure limits, cancelled/expired attempts and provider rejection.
- Read-only live GETs for public listings, Product 19 and seller 16 return 200 and
  contain no checked sensitive keys or Riot PUUID value. Withdrawal API tests reject
  leakage of OTP/token/password fields and internal storage metadata.
- Backend search finds no runtime references to dropped tables, old role repository,
  `findIdsByCodes` or `assignRoles`. Historical SQL and the integrity adapter retain
  old names intentionally.
- No frontend source, route or controller changed as part of the storage refactor.
  Browser rendering and delivery through real email/SMS/payment providers still need
  the manual checks below; automated tests cannot prove absence of every regression.

## 9. Phase commits

| Checkpoint | Commit |
| --- | --- |
| Valorant storage | `33b8b03` |
| Seller document storage | `e2810b7` |
| Roles from account mode | `9a2c8b6` |
| Wallet balance storage | `b331a64` |
| Support chat storage | `a803ced` |
| Report storage | `db55cf9` |
| Withdrawal storage | `b394ba0` |

All work remains on `refactor/db-21-tables`; no push to main/master was performed.
The full SQL backup was not copied into the repository or modified.

## 10. Suggested manual smoke test

1. Sign in with existing CUSTOMER, SELLER and ADMIN accounts; refresh the page,
   sign out and sign back in. Confirm role-specific pages and forbidden actions.
2. Open Home, Listings, Product 19, My Listings and seller/user profiles. Confirm
   images, prices and the Valorant badge; inspect public responses for private data.
3. Compare wallet balance/history with the original records. Exercise a top-up and
   a small test purchase/sale/refund using the normal application workflow.
4. Upload all three seller documents on a test account, submit, and inspect/approve
   or reject in Admin. Open an existing application's documents too.
5. Send marketplace chat messages in both directions; check unread/read state.
   Open Support as a user and reply as Admin; check assignment and close/open state.
6. Open existing review and transaction reports, their order details and chat
   review; exercise resolution on a test report and check Admin statistics.
7. On a funded test account, withdraw using real Email then Phone OTP. Check wrong
   codes, expiry and duplicate confirmation. Verify the request/history appears
   once and the balance decreases once.
8. Approve one test withdrawal and reject another as Admin. Approval must not debit
   again; rejection must refund once and preserve the reason/history/notification.

Manual actions intentionally change data; the frozen integrity baseline is for the
refactor checkpoint and should not be overwritten just to accept subsequent usage.
