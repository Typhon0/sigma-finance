# Automated Account Synchronization Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a generic, in-process, global account synchronization engine for Sigma Finance supporting direct crypto APIs (Kraken), multi-broker aggregators (SnapTrade for Trade Republic & international brokers), European Open Banking (GoCardless for Revolut/Fortuneo), and an open-source adapter development guide for community-contributed regional providers (Japan, China, etc.).

**Architecture:** A domain-driven sync subsystem built within the Go backend under Clean Architecture. Domain models represent credentials, connections, and audit runs. A core `SyncService` coordinates an extensible `ISyncAdapter` interface with dedicated adapters (`KrakenAdapter`, `SnapTradeAdapter`, `GoCardlessAdapter`). Reconciles positions and cash atomically via `uow.Do` using a snapshot-first strategy. Exposed via GraphQL and managed in the React/Tailwind frontend.

**Tech Stack:** Go 1.24, Bun ORM, PostgreSQL, Fiber v2, gqlgen, AES-256-GCM, React 18, Vite, Apollo Client, Tailwind CSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-account-sync-engine-design.md`

## Global Constraints

- **Language & Stack**: Go 1.24+ backend, Bun ORM, PostgreSQL, Fiber v2, gqlgen (GraphQL), React / Vite / Apollo Client / Tailwind CSS frontend.
- **Clean Architecture**: Domain models (`server/internal/domain/model`) must not depend on external HTTP or sync libraries. Repositories handle database persistence; services handle business logic; adapters encapsulate external API clients.
- **Monetary Precision**: All monetary values must be represented as integer cents (`model.Money`) and quantities as `decimal.Decimal`. Support multi-currency normalization (`EUR`, `USD`, `GBP`, `JPY`, `CNY`, `HKD`).
- **Database Consistency**: Multi-entity sync updates must execute within atomic units of work (`s.uow.Do`).
- **Security**: All API keys, secrets, access tokens, and refresh tokens must be encrypted at rest using AES-256-GCM (`ENCRYPTION_KEY`).

## Review Focus

1. **Provider 429 Rate Limiting**: When Kraken, SnapTrade, or GoCardless returns HTTP 429, the sync run records a structured error and leaves existing account positions untouched. (Tested in Tasks 4, 5, and 6).
2. **Truncated Historical Transactions / Quantity Discrepancy**: When `FetchHoldings` returns a quantity greater than the sum of available historical buy transactions, an opening baseline tax lot is generated for the residual quantity with earliest cost basis. (Tested in Task 3).
3. **Unmatched / Unknown Catalog Instrument**: When a synced ticker or ISIN does not exist in the instrument catalog, a placeholder `UNMAPPED` asset is provisioned and flagged in sync warnings instead of crashing. (Tested in Task 3).
4. **Invalid / Expired External Credentials**: When external API returns HTTP 401/403, the connection status updates to `INVALID` or `EXPIRED` and the sync run marks `FAILED` with the provider's message. (Tested in Task 3 & Task 4).
5. **Liquidated / Zero-Quantity Position**: When an asset previously held is omitted from `FetchHoldings`, `Position.Quantity` is updated to `0` rather than deleting the row. (Tested in Task 3).

---

### Task 1: Database Migration & Domain Models

**Files:**
- Create: `server/cmd/bun/migrations/20261025_account_sync_schema.go`
- Create: `server/internal/domain/model/sync.go`
- Create: `server/internal/domain/model/sync_test.go`
- Modify: `server/internal/domain/model/account.go:40-47`
- Modify: `server/internal/domain/model/transaction.go:30-40`

**Interfaces:**
- Produces:
  - `model.SyncCredential` with AES-256 `Encrypt()` and `Decrypt()` methods
  - `model.SyncConnection` representing an account linkage to an external institution
  - `model.SyncRun` for audit logging
  - `Account.SyncProvider`, `Account.ExternalID`
  - `Transaction.ExternalID` with unique index `(account_id, external_id)`

- [ ] **Step 1: Write the failing domain model and validation test**

```go
// server/internal/domain/model/sync_test.go
package model_test

import (
	"testing"
	"sigma-finance/server/internal/domain/model"
)

func TestSyncCredential_ValidationAndEncryption(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	cred := &model.SyncCredential{
		UserID:   "user-123",
		Provider: "KRAKEN",
		RawData:  `{"apiKey":"test-key","apiSecret":"test-secret"}`,
	}
	if err := cred.Validate(); err != nil {
		t.Fatalf("validation failed: %v", err)
	}
	if err := cred.Encrypt(); err != nil {
		t.Fatalf("encryption failed: %v", err)
	}
	if cred.EncryptedData == "" || cred.EncryptedData == cred.RawData {
		t.Fatalf("expected EncryptedData to be encrypted cipher text")
	}
	decrypted, err := cred.Decrypt()
	if err != nil {
		t.Fatalf("decryption failed: %v", err)
	}
	if decrypted != cred.RawData {
		t.Fatalf("expected decrypted %s, got %s", cred.RawData, decrypted)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && go test -v ./internal/domain/model -run TestSyncCredential_ValidationAndEncryption`  
Expected: FAIL with undefined `SyncCredential`

- [ ] **Step 3: Implement `SyncCredential`, `SyncConnection`, `SyncRun` and migration**

Implement the domain structs in `server/internal/domain/model/sync.go` with AES-256-GCM encryption methods matching `market_data_credential.go`.  
Add migration in `server/cmd/bun/migrations/20261025_account_sync_schema.go` creating `sigma_finance.sync_credentials`, `sigma_finance.sync_connections`, `sigma_finance.sync_runs`, adding `external_id` to `accounts` and `transactions` with unique index.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && go test -v ./internal/domain/model -run TestSyncCredential_ValidationAndEncryption`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/domain/model/sync.go server/internal/domain/model/sync_test.go server/cmd/bun/migrations/20261025_account_sync_schema.go
git commit -m "feat(sync): add database schema and domain models for account sync"
```

---

### Task 2: Repository Layer for Sync Entities

**Files:**
- Create: `server/internal/repository/sync_repo.go`
- Create: `server/internal/repository/sync_repo_test.go`
- Modify: `server/internal/repository/uow.go:20-50`

**Interfaces:**
- Consumes: `model.SyncCredential`, `model.SyncConnection`, `model.SyncRun`
- Produces: `ISyncRepository` interface with methods:
  - `CreateCredential(ctx context.Context, cred *model.SyncCredential) error`
  - `GetCredentialByID(ctx context.Context, id string) (*model.SyncCredential, error)`
  - `GetCredentialByProvider(ctx context.Context, userID string, provider string) (*model.SyncCredential, error)`
  - `CreateConnection(ctx context.Context, conn *model.SyncConnection) error`
  - `GetConnectionByID(ctx context.Context, id string) (*model.SyncConnection, error)`
  - `ListConnectionsByPortfolio(ctx context.Context, portfolioID string) ([]*model.SyncConnection, error)`
  - `UpdateConnection(ctx context.Context, conn *model.SyncConnection) error`
  - `CreateSyncRun(ctx context.Context, run *model.SyncRun) error`
  - `UpdateSyncRun(ctx context.Context, run *model.SyncRun) error`
  - Exposed via `uow.Sync()`

- [ ] **Step 1: Write the failing repository unit test**

```go
// server/internal/repository/sync_repo_test.go
package repository_test

import (
	"context"
	"testing"
	"sigma-finance/server/internal/domain/model"
)

func TestSyncRepository_CreateAndGetCredential(t *testing.T) {
	// test with in-memory or mock DB Bun setup
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && go test -v ./internal/repository -run TestSyncRepository_CreateAndGetCredential`  
Expected: FAIL with interface or implementation missing

- [ ] **Step 3: Implement `SyncRepository` and register with Unit of Work**

Implement `SyncRepository` in `server/internal/repository/sync_repo.go` using Bun ORM queries. Add `Sync() ISyncRepository` to `IUnitOfWork` in `uow.go`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && go test -v ./internal/repository -run TestSyncRepository_CreateAndGetCredential`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/repository/sync_repo.go server/internal/repository/sync_repo_test.go server/internal/repository/uow.go
git commit -m "feat(sync): implement sync repository and unit of work integration"
```

---

### Task 3: Core Sync Service & Ingestion Pipeline

**Files:**
- Create: `server/internal/service/sync/adapter.go`
- Create: `server/internal/service/sync/service.go`
- Create: `server/internal/service/sync/reconciliation.go`
- Create: `server/internal/service/sync/service_test.go`

**Interfaces:**
- Consumes: `ISyncRepository`, `IPortfolioRepository`, `IPositionRepository`, `ITransactionRepository`, `IInstrumentService`
- Produces: `ISyncService` with methods:
  - `RegisterAdapter(adapter SyncAdapter)`
  - `TriggerSync(ctx context.Context, connectionID string) (*model.SyncRun, error)`
  - `RegisterCredential(ctx context.Context, userID string, provider string, rawJSON string) (*model.SyncCredential, error)`
  - `LinkAccount(ctx context.Context, connectionID string, accountID string, autoCreate bool) (*model.SyncConnection, error)`

- [ ] **Step 1: Write failing tests for snapshot reconciliation, opening baseline tax lots, and unmatched instruments**

```go
// server/internal/service/sync/service_test.go
package sync_test

import (
	"context"
	"testing"
	"github.com/shopspring/decimal"
	"sigma-finance/server/internal/service/sync"
)

func TestSyncService_ReconciliationSnapshotWithResidualTaxLot(t *testing.T) {
	// Mock adapter returning 10 shares of AAPL
	// Mock transaction repo returning only 2 shares bought historically
	// Assert Position.Quantity == 10
	// Assert an opening baseline tax lot of 8 shares was created with earliest cost basis
}

func TestSyncService_UnmatchedInstrumentCreatesPlaceholder(t *testing.T) {
	// Mock adapter returning an unlisted ticker "UNKNOWN_TOKEN"
	// Assert placeholder asset UNMAPPED created, position created, warning logged
}

func TestSyncService_ZeroBalanceUpdatesQuantityToZero(t *testing.T) {
	// Existing position with quantity 5
	// External holding is absent (0)
	// Assert Position.Quantity updated to 0, row not deleted
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && go test -v ./internal/service/sync -run TestSyncService_ReconciliationSnapshotWithResidualTaxLot`  
Expected: FAIL

- [ ] **Step 3: Implement `SyncService`, `SyncAdapter` contract, and atomic reconciliation**

Implement `server/internal/service/sync/adapter.go` with normalized types (`RawAccount`, `RawBalance`, `RawHolding`, `RawTransaction`).  
Implement `server/internal/service/sync/reconciliation.go`:
- Reconciles cash via `AssetTypeBankAccount` position under the account.
- Reconciles holdings via `Position` quantity matching.
- Creates baseline opening tax lots for unallocated quantities.
- Sets quantity to 0 for liquidated positions.
- Ingests transactions with deduplication on `(account_id, external_id)`.
Wrap all operations in `s.uow.Do(ctx, ...)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && go test -v ./internal/service/sync/...`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/service/sync/
git commit -m "feat(sync): implement core sync service and reconciliation pipeline"
```

---

### Task 4: Kraken Direct Adapter (Global Crypto)

**Files:**
- Create: `server/internal/service/sync/adapters/kraken.go`
- Create: `server/internal/service/sync/adapters/kraken_test.go`

**Interfaces:**
- Consumes: `SyncAdapter` interface, Kraken REST API
- Produces: `KrakenAdapter` implementing `SyncAdapter`:
  - `Provider() string` ("KRAKEN")
  - `TestConnection(ctx, cred) error`
  - `FetchAccounts(ctx, cred) ([]RawAccount, error)`
  - `FetchBalances(ctx, cred, externalAccountID) ([]RawBalance, error)`
  - `FetchHoldings(ctx, cred, externalAccountID) ([]RawHolding, error)`
  - `FetchTransactions(ctx, cred, externalAccountID, since) ([]RawTransaction, error)`

- [ ] **Step 1: Write failing adapter test with mock Kraken HTTP responses**

```go
// server/internal/service/sync/adapters/kraken_test.go
package adapters_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"sigma-finance/server/internal/service/sync/adapters"
)

func TestKrakenAdapter_FetchBalancesAndHoldings(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify HMAC-SHA512 auth headers
		// Return sample Kraken JSON response with ZEUR and XXBT
	}))
	defer server.Close()
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && go test -v ./internal/service/sync/adapters -run TestKrakenAdapter_FetchBalancesAndHoldings`  
Expected: FAIL

- [ ] **Step 3: Implement `KrakenAdapter`**

Implement HTTP client with HMAC-SHA512 signature (`API-Key` and `API-Sign` headers), Kraken asset normalization (`XXBT` -> `BTC`, `XETH` -> `ETH`, `ZEUR` -> `EUR`, `ZUSD` -> `USD`, `ZJPY` -> `JPY`), parsing of `/0/private/Balance`, `/0/private/OpenPositions`, and `/0/private/Ledgers`. Handle HTTP 429 rate limits gracefully.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && go test -v ./internal/service/sync/adapters -run TestKrakenAdapter_`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/service/sync/adapters/kraken.go server/internal/service/sync/adapters/kraken_test.go
git commit -m "feat(sync): implement Kraken direct API sync adapter"
```

---

### Task 5: SnapTrade Aggregator Adapter (Trade Republic & International Brokers)

**Files:**
- Create: `server/internal/service/sync/adapters/snaptrade.go`
- Create: `server/internal/service/sync/adapters/snaptrade_test.go`

**Interfaces:**
- Consumes: `SyncAdapter` interface, SnapTrade REST API
- Produces: `SnapTradeAdapter` implementing `SyncAdapter`:
  - `Provider() string` ("SNAPTRADE")
  - `GeneratePortalLink(ctx, userID, redirectURL) (string, error)`
  - `FetchAccounts(ctx, cred) ([]RawAccount, error)`
  - `FetchBalances(ctx, cred, externalAccountID) ([]RawBalance, error)`
  - `FetchHoldings(ctx, cred, externalAccountID) ([]RawHolding, error)`
  - `FetchTransactions(ctx, cred, externalAccountID, since) ([]RawTransaction, error)`

- [ ] **Step 1: Write failing adapter test with mock SnapTrade responses**

```go
// server/internal/service/sync/adapters/snaptrade_test.go
package adapters_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"sigma-finance/server/internal/service/sync/adapters"
)

func TestSnapTradeAdapter_FetchTradeRepublicHoldings(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Mock SnapTrade /api/v1/accounts and /holdings payloads with Trade Republic holdings
	}))
	defer server.Close()
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && go test -v ./internal/service/sync/adapters -run TestSnapTradeAdapter_FetchTradeRepublicHoldings`  
Expected: FAIL

- [ ] **Step 3: Implement `SnapTradeAdapter`**

Implement SnapTrade HMAC-SHA256 request signing, user registration, login portal session URL generation, and retrieval of accounts, cash balances, holdings, and activities. Support Trade Republic and international brokerage normalization.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && go test -v ./internal/service/sync/adapters -run TestSnapTradeAdapter_`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/service/sync/adapters/snaptrade.go server/internal/service/sync/adapters/snaptrade_test.go
git commit -m "feat(sync): implement SnapTrade aggregator adapter for Trade Republic and brokers"
```

---

### Task 6: GoCardless Open Banking Adapter (European Banks)

**Files:**
- Create: `server/internal/service/sync/adapters/gocardless.go`
- Create: `server/internal/service/sync/adapters/gocardless_test.go`

**Interfaces:**
- Consumes: `SyncAdapter` interface, GoCardless Bank Account Data API
- Produces: `GoCardlessAdapter` implementing `SyncAdapter`:
  - `Provider() string` ("GOCARDLESS")
  - `CreateRequisition(ctx, institutionID, redirectURL) (requisitionID, link string, error)`
  - `FetchAccounts(ctx, cred) ([]RawAccount, error)`
  - `FetchBalances(ctx, cred, externalAccountID) ([]RawBalance, error)`
  - `FetchTransactions(ctx, cred, externalAccountID, since) ([]RawTransaction, error)`

- [ ] **Step 1: Write failing test with mock GoCardless requisition and balance responses**

```go
// server/internal/service/sync/adapters/gocardless_test.go
package adapters_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"sigma-finance/server/internal/service/sync/adapters"
)

func TestGoCardlessAdapter_FetchBankBalancesAndTransactions(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Mock GoCardless token, requisition, accounts, balances, transactions
	}))
	defer server.Close()
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && go test -v ./internal/service/sync/adapters -run TestGoCardlessAdapter_FetchBankBalancesAndTransactions`  
Expected: FAIL

- [ ] **Step 3: Implement `GoCardlessAdapter`**

Implement OAuth2 token management (`/api/v2/token/new/`), requisition building (`/api/v2/requisitions/`), account discovery (`/api/v2/accounts/{id}/`), balances (`/api/v2/accounts/{id}/balances/`), and transactions parsing (`/api/v2/accounts/{id}/transactions/`). Map Revolut, Fortuneo, and European bank transactions into domain structures.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && go test -v ./internal/service/sync/adapters -run TestGoCardlessAdapter_`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/service/sync/adapters/gocardless.go server/internal/service/sync/adapters/gocardless_test.go
git commit -m "feat(sync): implement GoCardless Open Banking adapter for European banks"
```

---

### Task 7: Developer Guide & Adapter Extension SDK

**Files:**
- Create: `docs/sync-adapter-guide.md`
- Create: `server/internal/service/sync/adapters/example_adapter.go`

**Interfaces:**
- Produces comprehensive developer documentation and template for open-source community contributors:
  - Explains how to create a new regional adapter (e.g. for Japan: SBI, Rakuten Securities; for China: Futu/Moomoo, Tiger Brokers).
  - Documents currency code normalization, ISIN/ticker mapping, rate limiting, and testing patterns.

- [ ] **Step 1: Author developer documentation and example template**

Write `docs/sync-adapter-guide.md` covering architecture, interface contracts, error handling, and unit test guidelines. Create `example_adapter.go` with complete comments.

- [ ] **Step 2: Commit**

```bash
git add docs/sync-adapter-guide.md server/internal/service/sync/adapters/example_adapter.go
git commit -m "docs(sync): add regional adapter extension guide for open-source contributors"
```

---

### Task 8: GraphQL Schema, Resolvers, and API Exposure

**Files:**
- Create: `server/internal/handler/graphql/schema/sync.graphqls`
- Modify: `server/internal/handler/graphql/schema/account.graphqls`
- Create: `server/internal/handler/graphql/sync.resolvers.go`
- Create: `server/internal/handler/graphql/sync_resolvers_test.go`
- Modify: `server/cmd/app.go` (Dependency injection wiring)

**Interfaces:**
- Produces GraphQL schema types:
  - `type SyncConnection`, `type SyncCredential`, `type SyncRun`, `type AggregatorAuthSession`
  - Query: `syncConnections(portfolioId: ID!): [SyncConnection!]! @auth`
  - Mutation: `registerSyncCredential(provider: String!, credentials: JSON!): SyncCredential! @auth`
  - Mutation: `generateAggregatorLink(provider: String!, redirectUrl: String!): AggregatorAuthSession! @auth`
  - Mutation: `completeAggregatorAuth(connectionId: ID!, sessionToken: String!): [SyncConnection!]! @auth`
  - Mutation: `linkSyncAccount(connectionId: ID!, accountId: ID!, autoCreate: Boolean): SyncConnection! @auth`
  - Mutation: `triggerAccountSync(accountId: ID!): SyncRun! @auth`

- [ ] **Step 1: Write failing GraphQL resolver test**

```go
// server/internal/handler/graphql/sync_resolvers_test.go
package graphql_test

import (
	"context"
	"testing"
)

func TestGraphQL_TriggerAccountSyncMutation(t *testing.T) {
	// Test executing triggerAccountSync mutation
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && go test -v ./internal/handler/graphql -run TestGraphQL_TriggerAccountSyncMutation`  
Expected: FAIL

- [ ] **Step 3: Add `sync.graphqls`, run gqlgen, implement resolvers, and wire in `app.go`**

Define schema in `server/internal/handler/graphql/schema/sync.graphqls`.  
Run `go run github.com/99designs/gqlgen generate`.  
Implement resolvers in `sync.resolvers.go` mapping to `ISyncService`.  
Wire `ISyncService` into `app.go` and inject into `Resolver`.

- [ ] **Step 4: Run resolver tests to verify they pass**

Run: `cd server && go test -v ./internal/handler/graphql -run TestGraphQL_`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/internal/handler/graphql/schema/sync.graphqls server/internal/handler/graphql/sync.resolvers.go server/cmd/app.go
git commit -m "feat(sync): expose account sync engine via GraphQL mutations and queries"
```

---

### Task 9: Frontend Sync Management & UI Integration

**Files:**
- Create: `client/src/graphql/mutations/sync.ts`
- Create: `client/src/graphql/queries/sync.ts`
- Create: `client/src/components/sync/ConnectInstitutionDialog.tsx`
- Create: `client/src/components/sync/SyncStatusBadge.tsx`
- Modify: `client/src/components/account/CreateAccountDialog.tsx:85-150`
- Modify: `client/src/components/settings/MarketDataCenter.tsx` (Add sync credentials tab/card)
- Create: `client/src/components/sync/__tests__/ConnectInstitutionDialog.test.tsx`

**Interfaces:**
- Consumes: GraphQL queries and mutations (`TRIGGER_ACCOUNT_SYNC`, `GENERATE_AGGREGATOR_LINK`, `GET_SYNC_CONNECTIONS`)
- Produces:
  - `ConnectInstitutionDialog`: UI modal guiding user through connecting Kraken (direct API Key/Secret), Trade Republic / Brokers (SnapTrade redirect), or European Banks (GoCardless Open Banking).
  - `SyncStatusBadge`: Displays `Synced 5m ago`, `Syncing`, `Sync Failed` with a 1-click "Sync Now" action button.
  - Integration tab in Settings.

- [ ] **Step 1: Write failing frontend unit tests for `ConnectInstitutionDialog`**

```tsx
// client/src/components/sync/__tests__/ConnectInstitutionDialog.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConnectInstitutionDialog } from "../ConnectInstitutionDialog";

describe("ConnectInstitutionDialog", () => {
  it("renders provider options for Kraken, Trade Republic, and European Banks", () => {
    render(<ConnectInstitutionDialog open={true} onOpenChange={vi.fn()} portfolioId="port-1" />);
    expect(screen.getByText(/Kraken/i)).toBeInTheDocument();
    expect(screen.getByText(/Trade Republic/i)).toBeInTheDocument();
    expect(screen.getByText(/European Banks/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && pnpm test ConnectInstitutionDialog`  
Expected: FAIL with module not found

- [ ] **Step 3: Implement frontend components and GraphQL operations**

Create GraphQL operations in `client/src/graphql/mutations/sync.ts` and `client/src/graphql/queries/sync.ts`.  
Implement `ConnectInstitutionDialog.tsx` supporting:
- Direct Kraken credentials modal (Key, Secret).
- SnapTrade OAuth/portal redirect for Trade Republic & international brokers.
- GoCardless Open Banking redirect for European banks.
Implement `SyncStatusBadge.tsx` with refresh trigger and loading spinner.  
Add "Connect Institution" trigger to `CreateAccountDialog.tsx` and account views.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && pnpm test ConnectInstitutionDialog`  
Expected: PASS

- [ ] **Step 5: Run full frontend test suite and build verification**

Run: `cd client && pnpm test && pnpm build`  
Expected: PASS with 0 build errors

- [ ] **Step 6: Commit**

```bash
git add client/src/graphql/ client/src/components/sync/ client/src/components/account/
git commit -m "feat(sync): add frontend institution connection dialog and sync status controls"
```

---

### Task 10: End-to-End Verification & Health Check

**Files:**
- Create: `server/cmd/test_sync_flow_test.go`

**Interfaces:**
- Verifies entire end-to-end sync lifecycle:
  1. Register encrypted credential in DB
  2. Create connection linked to a test portfolio
  3. Trigger sync through `SyncService`
  4. Assert holdings match snapshot, cash is recorded, transactions are deduplicated, and tax lots are created
  5. Assert audit log in `sync_runs` is marked `COMPLETED`

- [ ] **Step 1: Write end-to-end integration test**

```go
// server/cmd/test_sync_flow_test.go
package main_test

import (
	"context"
	"testing"
)

func TestFullSyncLifecycle(t *testing.T) {
	// Full simulated lifecycle test using in-memory / test database
}
```

- [ ] **Step 2: Run all backend tests**

Run: `cd server && go test -v ./...`  
Expected: ALL PASS

- [ ] **Step 3: Run all client tests**

Run: `cd client && pnpm test`  
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add server/cmd/test_sync_flow_test.go
git commit -m "test(sync): add end-to-end integration tests for account synchronization engine"
```
