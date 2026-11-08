# Revolut Sync Check Constraint Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve Revolut synchronization errors by preventing zero-amount card pre-authorizations and non-positive cash balance prices from violating PostgreSQL database check constraints (`valid_amount` and `valid_price`).

**Architecture:** Filter zero-amount card authorization entries (€0.00 / $0.00) at both the adapter layer (`adapters/enablebanking.go`) and the reconciliation engine layer (`reconciliation.go`), and guard `AssetPrice.UpsertPrices` in `ReconcileBalances` so it only upserts prices when `bal.Amount.IsPositive()`.

**Tech Stack:** Go 1.23, PostgreSQL 16, Bun ORM, Docker Compose.

**Spec:** Fix two database check constraints on table `sigma_finance.asset_prices` and `sigma_finance.transactions`:
1. `CONSTRAINT valid_price CHECK (price > 0)` on `asset_prices`.
2. `CONSTRAINT valid_amount CHECK (amount != 0)` on `transactions`.

---

## Global Constraints

- Never weaken or drop database check constraints (`amount != 0` and `price > 0` are core schema invariants).
- Adhere to the Minimal Diff Principle: only modify sync ingestion logic for zero amounts/non-positive prices.
- Always rebuild and recreate the backend container (`docker compose build server && docker compose up -d server`) after backend changes.
- Preserve all existing tests and ensure clean test passes.

## Review Focus

1. **Revolut zero-amount card verification checks (€0.00 / $0.00)**: Must be skipped and not inserted into `sigma_finance.transactions`.
2. **Revolut multi-currency pockets / accounts with zero balance (0.00)**: Must create or update cash positions with `quantity = 0` without attempting to insert `price = 0` into `sigma_finance.asset_prices`.
3. **Revolut accounts with negative balance (overdraft)**: Must create clamped cost basis positions without attempting to insert negative price into `sigma_finance.asset_prices`.
4. **Transaction block atomicity in `uow.Do`**: Any failed SQL statement marks the transaction aborted in PostgreSQL; no invalid SQL statements must be executed.
5. **Multi-currency isolation**: Standard EUR accounts and foreign currency pockets (USD, GBP, CHF, JPY, CNY, HUF, etc.) must all sync cleanly.

---

### Task 1: Filter Zero-Amount Transactions in Enable Banking Adapter & Reconciliation

**Files:**
- Modify: `server/internal/service/sync/adapters/enablebanking.go:464-478`
- Modify: `server/internal/service/sync/reconciliation.go:453-468`
- Test: `server/internal/service/sync/adapters/enablebanking_test.go`
- Test: `server/internal/service/sync/service_test.go`

**Interfaces:**
- Consumes: `item.TransactionAmount.Amount` from Enable Banking API; `rawTx.Amount` in `ReconcileTransactions`.
- Produces: `TransactionsSnapshot` with only non-zero transactions; `ReconcileTransactions` skipping `rawTx.Amount == 0`.

- [ ] **Step 1: Write failing unit tests for zero-amount transaction filtering**
  - In `server/internal/service/sync/adapters/enablebanking_test.go`: Add test case with `amount: "0.00"` (e.g. PayPal card verification check) and verify it is not included in `resp.Transactions`.
  - In `server/internal/service/sync/service_test.go`: Add test verifying that `ReconcileTransactions` skips `rawTx.Amount == 0` without error.

- [ ] **Step 2: Run tests to verify failure**
  ```bash
  go test -C server -v -run TestEnableBankingAdapter_FetchTransactions_ZeroAmount ./internal/service/sync/adapters/...
  ```

- [ ] **Step 3: Implement zero-amount filtering in adapter and reconciliation engine**
  - In `server/internal/service/sync/adapters/enablebanking.go`:
    ```go
    absAmt := amtDec.Abs()
    cents := int64(math.Round(absAmt.Mul(decimal.NewFromInt(100)).InexactFloat64()))
    if absAmt.IsZero() || cents == 0 {
        // Zero-amount card verification check (e.g. PayPal, Amazon, Tesla €0.00 pre-authorization)
        continue
    }
    ```
  - In `server/internal/service/sync/reconciliation.go`:
    ```go
    if rawTx.Amount == 0 {
        continue
    }
    ```

- [ ] **Step 4: Run tests to verify pass**
  ```bash
  go test -C server -v ./internal/service/sync/adapters/...
  go test -C server -v -run TestSyncService_ReconcileTransactions ./internal/service/sync/...
  ```

---

### Task 2: Guard Asset Price Upsert for Zero or Negative Cash Balances

**Files:**
- Modify: `server/internal/service/sync/reconciliation.go:59-68`
- Test: `server/internal/service/sync/service_test.go`

**Interfaces:**
- Consumes: `bal.Amount` in `ReconcileBalances`.
- Produces: Safe invocation of `uow.AssetPrice().UpsertPrices` only when `bal.Amount.IsPositive()`.

- [ ] **Step 1: Write unit test for ReconcileBalances with zero and negative balances**
  - In `server/internal/service/sync/service_test.go`: Add test `TestSyncService_ReconcileBalances_ZeroAndNegative` verifying that zero balance (0.00 EUR) and negative balance (-50.00 EUR) do not invoke `UpsertPrices` with non-positive values, and position is correctly created/updated.

- [ ] **Step 2: Run test to verify behavior**
  ```bash
  go test -C server -v -run TestSyncService_ReconcileBalances_ZeroAndNegative ./internal/service/sync/...
  ```

- [ ] **Step 3: Apply guard in `server/internal/service/sync/reconciliation.go`**
  ```go
  // Update latest asset price to reflect current balance (only when balance is positive,
  // respecting PostgreSQL constraint valid_price CHECK (price > 0))
  if bal.Amount.IsPositive() {
      _ = uow.AssetPrice().UpsertPrices(ctx, []model.AssetPrice{
          {
              AssetID:   asset.ID,
              Price:     bal.Amount,
              Timestamp: time.Now(),
              Source:    "sync",
          },
      })
  }
  ```

- [ ] **Step 4: Run unit tests to verify pass**
  ```bash
  go test -C server -v ./internal/service/sync/...
  ```

---

### Task 3: Build, Restart, and Verify Full Revolut Sync

**Files:**
- N/A (Docker container build & live verification)

- [ ] **Step 1: Rebuild and recreate backend container**
  ```bash
  docker compose build server && docker compose up -d server
  ```

- [ ] **Step 2: Verify container health**
  ```bash
  docker compose ps server
  ```

- [ ] **Step 3: Trigger sync for user's Revolut connections and monitor logs**
  - Check `docker compose logs server --tail 100` for `status=COMPLETED` and absence of `valid_amount` or `current transaction is aborted` errors.
  - Verify all 11 accounts show `IDLE` / `COMPLETED` in UI.

