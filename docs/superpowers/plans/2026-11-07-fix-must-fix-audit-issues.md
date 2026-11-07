# Fix Must-Fix Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all 7 critical "Must Fix" defects identified during the repository audit to restore accounting accuracy, database integrity, request context propagation, test suite reliability, and API security.

**Architecture:** 
- Financial calculations in `server/internal/domain/model/money.go` will use `math.Round` to eliminate IEEE-754 precision loss during float-to-cent conversions.
- Transaction replaying during deletion in `server/internal/service/transaction_service.go` will sort transactions chronologically (`executed_at ASC, created_at ASC`) before updating position cost basis.
- Position creation in `server/internal/service/position_service.go` and `server/internal/domain/model/position.go` will enforce and auto-provision valid `account_id` references, aligning with foreign key constraints.
- Test initialization in `server/internal/testutil/testutil.go` will execute `migrations.Migrate` to ensure test database parity with production schemas.
- CORS policy and HTTP authentication in `server/cmd/app.go` and `server/internal/handler/middleware/auth.go` will restrict query-parameter tokens to SSE endpoints and restrict local network origins to non-production environments.

**Tech Stack:** Go (1.23+), Bun ORM, PostgreSQL, Fiber v2, gqlgen, Testify.

---

## Global Constraints

- Never use raw floating-point arithmetic for monetary calculations; always preserve `model.Money` (integer cents) semantics.
- All database write operations touching positions and accounts must execute within `uow.Do(ctx, ...)` transactions.
- Zero-downtime database integrity: every position must reference a valid account (`account_id UUID NOT NULL`).
- Standard API endpoints must require the `Authorization: Bearer <token>` header; URL query string token acceptance is forbidden except on SSE endpoints.

---

## Review Focus

- **Negative float inputs to FromFloat**: Negative float values (e.g. `-19.99`, `-0.125`) must round symmetrically to negative cents without integer sign distortion.
- **Multiple sells on position before deletion**: Positions with alternating buy, sell, and buy transactions must calculate correct remaining quantity and non-negative cost basis when any transaction is deleted.
- **Position creation without accounts**: New portfolios without pre-existing accounts must automatically create a default account so positions are never inserted with an empty string or NULL `account_id`.
- **CORS under production env vars**: Setting `ENVIRONMENT=production` or `ENV=production` must strictly reject unlisted origins even if they match RFC1918 private subnets.
- **Query param tokens on sensitive mutations**: Mutations like `createTransaction` or `updatePortfolio` must fail with 401 if the token is passed in `?token=` rather than the `Authorization` header.

---

## Tasks

### Task 1: Fix Float-to-Money Cent Truncation in Domain Model

**Files:**
- Modify: `server/internal/domain/model/money.go:13`
- Create: `server/internal/domain/model/money_test.go`

- [ ] Write failing unit tests in `server/internal/domain/model/money_test.go` checking `FromFloat(19.99)`, `FromFloat(147.23)`, `FromFloat(-0.125)`, `FromFloat(0.07)`, and `FromFloat(0.14)`.
- [ ] Run `cd server && go test -v -run TestFromFloat ./internal/domain/model/...` to confirm failure.
- [ ] Update `FromFloat` in `server/internal/domain/model/money.go` to use `math.Round(v * 100)`.
- [ ] Re-run `go test -v -run TestFromFloat ./internal/domain/model/...` to ensure all precision tests pass.

---

### Task 2: Replay Transactions Chronologically on Deletion

**Files:**
- Modify: `server/internal/service/transaction_service.go:317-340`
- Test: `server/internal/service/transaction_service_test.go`

- [ ] Write a test in `server/internal/service/transaction_service_test.go` simulating a position with: Buy 100 @ $10, Sell 50 @ $15, Buy 20 @ $12.
- [ ] Attempt to delete the second Buy transaction. Observe that without chronological ordering, replaying fails with "cannot sell 50 units, only 0 available".
- [ ] In `server/internal/service/transaction_service.go:DeleteTransaction`, sort `allTxns` by `executed_at ASC, created_at ASC` before iterating over `allTxns`.
- [ ] Run `cd server && go test -v -run TestDeleteTransaction ./internal/service/...` and verify tests pass.

---

### Task 3: Enforce and Auto-Provision account_id on Position Creation

**Files:**
- Modify: `server/internal/domain/model/position.go:76-101`
- Modify: `server/internal/service/position_service.go:56-120`
- Modify: `server/internal/service/transaction_service.go:525-545`
- Modify: `server/internal/repository/tax_lot_disposition_repo_test.go:51-60`
- Modify: `server/internal/handler/graphql/integration_test.go:508-515`

- [ ] In `server/internal/domain/model/position.go`, add `if p.AccountID == "" { return errors.New("account ID is required") }` to `Position.Validate()`.
- [ ] In `server/internal/service/position_service.go`, add `AccountID string` to `CreatePositionRequest`. In `CreatePosition`, resolve or auto-create a default account for the portfolio if `req.AccountID` is empty.
- [ ] In `server/internal/service/transaction_service.go:525`, add default account creation fallback if `len(accounts) == 0`.
- [ ] Update test fixtures in `tax_lot_disposition_repo_test.go` and `integration_test.go` to seed accounts and assign `AccountID`.
- [ ] Run `cd server && go test -v ./internal/domain/model/... ./internal/service/...` to verify position creation constraints pass.

---

### Task 4: Run Real Bun Migrations in Test Harness

**Files:**
- Modify: `server/internal/testutil/testutil.go:134-180`

- [ ] Import `sigma_finance/cmd/bun/migrations` in `server/internal/testutil/testutil.go`.
- [ ] Replace hardcoded SQL statements in `runTestMigrations` with `migrations.Migrate(ctx, db)`.
- [ ] Run `cd server && go test -v -run "TestSyncRepository|TestTaxLotDisposition" ./internal/repository/...` and confirm `cash_account_id` column errors are resolved.

---

### Task 5: Restrict Authentication Query Tokens to SSE Streams Only

**Files:**
- Modify: `server/internal/handler/middleware/auth.go:63-80`
- Test: `server/internal/handler/middleware/auth_test.go`

- [ ] Add unit tests in `server/internal/handler/middleware/auth_test.go` checking that `?token=` query param returns 401 on standard routes like `/api/test`, but succeeds on `/admin/logs/sse`.
- [ ] Update `AuthMiddleware` in `server/internal/handler/middleware/auth.go` to restrict query token extraction to SSE paths (`/admin/logs`, `/api/admin/logs`, or `Accept: text/event-stream`).
- [ ] Run `cd server && go test -v -run TestAuth ./internal/handler/middleware/...` to confirm assertions pass.

---

### Task 6: Secure Production CORS Rules

**Files:**
- Modify: `server/cmd/app.go:218-241`
- Test: `server/internal/handler/middleware/security_test.go`

- [ ] Inspect environment variables for production mode (`ENVIRONMENT=production` or `ENV=production`).
- [ ] In `server/cmd/app.go`, ensure wildcard IP prefixes (`http://localhost:`, `http://192.168.`, `http://10.`, `http://172.`) are ONLY permitted when NOT in production.
- [ ] Run `cd server && go test -v -run TestSecurity ./internal/handler/middleware/...`.

---

### Task 7: Propagate Request Context & Eliminate Redundant GraphQL Auth

**Files:**
- Modify: `server/cmd/app.go:562-615`

- [ ] In `server/cmd/app.go` around line 568, replace `context.Background()` with `r.Context()` for `ValidateSession` and `User.GetByID`.
- [ ] Ensure `customHandler` sets `middleware.UserKey` on `r.Context()`.
- [ ] Verify GraphQL request cancellation and session handling.
- [ ] Rebuild and test server container.

---

## Verification Plan

### Automated Tests
```bash
# 1. Money precision
cd /home/dev/repos/sigma-finance/server && go test -v -run TestFromFloat ./internal/domain/model/...

# 2. Transaction deletion replay
cd /home/dev/repos/sigma-finance/server && go test -v -run TestDeleteTransaction ./internal/service/...

# 3. Position validation and repository tests
cd /home/dev/repos/sigma-finance/server && go test -v -run "TestPosition|TestTaxLotDisposition|TestSyncRepository" ./internal/repository/... ./internal/service/...

# 4. Middleware & security tests
cd /home/dev/repos/sigma-finance/server && go test -v ./internal/handler/middleware/...

# 5. Full test sweep
cd /home/dev/repos/sigma-finance/server && go test ./internal/...
```

### Manual Verification
- Test query token rejection on standard endpoints:
  ```bash
  curl -i -X POST http://localhost:8080/graphql?token=sample-token
  ```
- Test query token acceptance on SSE stream:
  ```bash
  curl -i -N http://localhost:8080/admin/logs/sse?token=sample-token
  ```
- Build backend Docker container:
  ```bash
  docker compose build server
  ```
