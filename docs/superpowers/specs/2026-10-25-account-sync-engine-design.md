# Design Document: Automated Account Synchronization Engine

**Date:** 2026-10-25  
**Topic:** Multi-Provider Account Synchronization (Kraken, Trade Republic, and Generic Aggregator Bridges)  
**Status:** Ready for Approval  

---

## 1. Intent & The Why

Sigma Finance is an open-source, self-hosted portfolio tracker designed to give users a unified view of all their wealth across asset classes without surrendering data custody. Currently, accounts, holdings, and transactions must be inputted or imported manually. 

Users need automatic synchronization for their accounts so their cash balances, asset positions, and transactions stay up to date with zero recurring manual effort. The system must support diverse financial sources—ranging from direct crypto exchanges (Kraken) to retail stock brokerages (Trade Republic) and traditional bank accounts—through a generic, extensible synchronization architecture.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Generic Adapter Architecture**: Provide a clean `SyncAdapter` interface in Go that decouples external protocol details from core portfolio management logic.
- **Support Direct APIs**: Deliver a direct native integration for **Kraken** using official read-only API Key and Secret pairs.
- **Support Multi-Institution Aggregators**: Deliver an aggregator bridge architecture starting with **SnapTrade** to reliably connect **Trade Republic** and other retail stock brokers (and lay the foundation for Open Banking aggregators like GoCardless/Enable Banking).
- **Secure Encrypted Storage**: Securely store all external API keys, secrets, access tokens, and refresh tokens using Sigma Finance's AES-256-GCM encryption (`ENCRYPTION_KEY`).
- **Normalized Domain Ingestion**: Ingest and reconcile cash balances (`Account`), asset quantities (`Position`), and buy/sell/dividend/deposit records (`Transaction`) into existing domain models with atomic database transactions.
- **Dual Execution**: Support both on-demand manual synchronization (via GraphQL mutation) and periodic background polling (via a configurable worker).

### Non-Goals
- **Order Execution / Trading**: The sync engine is strictly read-only for portfolio tracking. No trade placing, transfers, or balance mutations on external institutions will ever be performed.
- **Unofficial Reverse-Engineered Scrapers**: We do not maintain fragile in-tree reverse-engineered mobile app scrapers for institutions that offer no public developer API (such as Trade Republic); instead, we bridge them via established aggregators (SnapTrade) or standard open protocols.
- **Real-Time Push / Tick-by-Tick Streaming**: Synchronization is balance and transaction reconciliation on an on-demand and periodic basis (e.g. hourly or daily), not a real-time order-book feed.

### Anti-Goals
- **Plaintext Credential Storage**: Never store external secrets, API keys, or tokens in plaintext in PostgreSQL.
- **Silent Ingestion Duplication**: Never create duplicate transactions or tax lots when a sync job runs repeatedly. Sync runs must be idempotent.
- **Vendor Lock-in**: Never hardcode a single commercial aggregator into core domain services.

---

## 3. Constraints

- **Language & Stack**: Go 1.24+ backend, Bun ORM, PostgreSQL, Fiber v2, gqlgen (GraphQL), React / Vite / Apollo Client / Tailwind CSS frontend.
- **Clean Architecture**: Domain models (`server/internal/domain/model`) must not depend on external HTTP or sync libraries. Repositories handle database persistence; services handle business logic; adapters encapsulate external API clients.
- **Monetary Precision**: All monetary values must be represented as integer cents (`model.Money`) and quantities as `decimal.Decimal`.
- **Database Consistency**: Multi-entity sync updates must execute within atomic units of work (`s.uow.Do`).

---

## 4. Approaches Considered

### Approach 1: Native In-Process Go Sync Engine (Selected)
- **Concept**: Implement the synchronization framework and provider adapters directly within the Go backend (`server/internal/service/sync/`).
- **Pros**:
  - Adds zero new container runtimes or deployment complexity to self-hosted `docker-compose.yml`.
  - Direct atomic transactions via `repository.IUnitOfWork` without IPC or network boundaries.
  - Consistent error handling, metrics, and security auditing within the single server binary.
  - Native Go concurrency (`goroutines`, channels, rate limiters) for clean background workers.
- **Cons**:
  - Requires aggregators (like SnapTrade) for closed brokers (like Trade Republic) rather than running arbitrary Python-based community scrapers.
- **Decision**: Chosen because it preserves the lightweight, reliable, self-hosted deployment profile while providing maximum architectural stability.

### Approach 2: Dedicated Microservice / Sidecar Sync Gateway
- **Concept**: Run a secondary container (e.g. Python FastAPI or Node.js) communicating via gRPC/HTTP with the Go backend, running scraping libraries (`pytr`, `woob`, `ccxt`).
- **Pros**:
  - Direct access to unofficial reverse-engineered scraping packages.
- **Cons**:
  - Increases memory footprint and operational complexity for home server users.
  - Community reverse-engineered scrapers frequently break with mobile app updates, requiring urgent patch cycles.
- **Decision**: Rejected due to maintenance fragility and deployment bloat.

---

## 5. Detailed Design & Architecture Decisions

### 5.1 Reconciliation Authority & Tax Lot Policy (Decided)
- **Snapshot-First Authority**: The external provider's `FetchHoldings` and `FetchBalances` are the authoritative source of truth for current position quantities and cash. When sync runs, positions immediately match the broker/exchange.
- **Transaction History & Tax Lots**: `FetchTransactions` imports historical trades, dividends, and cash flows to build the activity ledger and tax lot dispositions.
- **Baseline Opening Lot Provisioning**: If imported transactions do not account for the entire quantity reported by `FetchHoldings` (e.g., due to API transaction history limits), the engine provisions an initial baseline tax lot using the earliest available cost basis to keep portfolio performance and tax calculations consistent.
- **Zero-Quantity Disposals**: When a position is liquidated externally (absent or 0 quantity in `FetchHoldings`), `Position.Quantity` is updated to `0` rather than deleting the database row. This protects foreign key constraints and preserves historical analytics.

### 5.2 Cash Ingestion Architecture (Decided)
- Ingested cash balances from brokers and banks are represented via Sigma Finance's native asset model (`AssetTypeBankAccount` / cash position under the target `AccountID`).
- This guarantees total wealth, currency conversion, and historical daily snapshot calculations work out-of-the-box without requiring schema alterations to portfolio analytics.

### 5.3 Aggregator & Self-Hosted Network Model (Decided)
- **Self-Hosted NAT Compatibility**: Because self-hosted instances cannot receive inbound webhooks without complex tunnel setups, the connection lifecycle completes using frontend redirect callbacks:
  1. Frontend calls `generateAggregatorLink`.
  2. User authenticates on the aggregator portal (e.g., SnapTrade connecting Trade Republic).
  3. The portal redirects back to Sigma Finance with session parameters.
  4. Frontend invokes `completeAggregatorAuth` mutation, which immediately triggers account discovery and sync without waiting for webhooks.
- **Environment & User Credentials**: System-level SnapTrade credentials (`SNAPTRADE_CLIENT_ID`, `SNAPTRADE_CONSUMER_KEY`) can be provided via environment variables, or users can input custom credentials in application settings.

### 5.4 Domain Models & Database Schema

#### 1. `SyncCredential` (`sigma_finance.sync_credentials`)
Stores encrypted credentials associated with a user or system-level connection.
- `id`: UUID (Primary Key)
- `user_id`: UUID (Nullable for system-wide keys)
- `is_system`: Boolean (Default false)
- `provider`: String (`KRAKEN`, `SNAPTRADE`, `GOCARDLESS`)
- `encrypted_data`: Text (AES-256-GCM encrypted JSON payload containing `api_key`, `api_secret`, `access_token`, `refresh_token`, etc.)
- `status`: Enum (`ACTIVE`, `EXPIRED`, `INVALID`, `REVOKED`)
- `created_at`, `updated_at`: Timestamps

#### 2. `SyncConnection` (`sigma_finance.sync_connections`)
Represents an active institution link (e.g., a connected Trade Republic account through SnapTrade, or a connected Kraken account).
- `id`: UUID (Primary Key)
- `user_id`: UUID
- `portfolio_id`: UUID (Portfolio where synced accounts/positions reside)
- `credential_id`: UUID (References `SyncCredential`)
- `account_id`: UUID (Nullable foreign key referencing `sigma_finance.accounts`)
- `provider`: String
- `external_institution_id`: String (e.g., `trade-republic`, `kraken`)
- `external_account_id`: String (Institution's native account identifier)
- `institution_name`: String (e.g. "Trade Republic", "Kraken Spot")
- `sync_status`: Enum (`IDLE`, `SYNCING`, `SUCCESS`, `FAILED`)
- `last_sync_at`: Timestamp (Nullable)
- `last_error`: Text (Nullable)
- `created_at`, `updated_at`: Timestamps

#### 3. `SyncRun` (`sigma_finance.sync_runs`)
Audit log and status tracker for each synchronization execution.
- `id`: UUID (Primary Key)
- `connection_id`: UUID
- `status`: Enum (`IN_PROGRESS`, `COMPLETED`, `FAILED`)
- `items_imported`: Integer
- `items_updated`: Integer
- `error_message`: Text (Nullable)
- `started_at`, `completed_at`: Timestamps

#### 4. Enhancements to `sigma_finance.accounts` & `transactions`
- `Account.sync_provider`: Updated to store provider string (e.g., `KRAKEN`, `SNAPTRADE`).
- `Account.external_id`: Stores the institution's account ID.
- `Transaction.external_id`: Unique constraint `(account_id, external_id)` to enforce idempotent deduplication across repeated sync runs.

---

### 5.5 Provider Adapter Interface (`ISyncAdapter`)

Located in `server/internal/service/sync/adapter.go`:

```go
type SyncAdapter interface {
    Provider() string
    TestConnection(ctx context.Context, cred *model.SyncCredential) error
    FetchAccounts(ctx context.Context, cred *model.SyncCredential) ([]RawAccount, error)
    FetchBalances(ctx context.Context, cred *model.SyncCredential, externalAccountID string) ([]RawBalance, error)
    FetchHoldings(ctx context.Context, cred *model.SyncCredential, externalAccountID string) ([]RawHolding, error)
    FetchTransactions(ctx context.Context, cred *model.SyncCredential, externalAccountID string, since *time.Time) ([]RawTransaction, error)
}
```

#### Initial Adapters
1. **`KrakenAdapter`**:
   - Calls Kraken's official API (`/0/private/Balance`, `/0/private/OpenPositions`, `/0/private/Ledgers`).
   - Authenticates using HMAC-SHA512 request signing.
   - Normalizes Kraken currency codes (`XXBT` -> `BTC`, `ZEUR` -> `EUR`).
2. **`SnapTradeAdapter`**:
   - Manages user registration (`/api/v1/snapTrade/registerUser`) and connection portal redirect URLs (`/api/v1/snapTrade/login`).
   - Fetches accounts, balances, and stock positions (`/api/v1/accounts`, `/api/v1/accounts/{accountId}/holdings`, `/api/v1/accounts/{accountId}/activities`).
   - Surfaces Trade Republic holdings, cash, and trade activities.

---

### 5.6 Unmatched Instrument Handling Policy
If an external asset ticker, ISIN, or crypto symbol cannot be resolved against the existing catalog:
- The engine creates a placeholder `Asset` marked as `UNMAPPED` with the reported symbol and name.
- The position is created under this placeholder so account valuations accurately include it.
- A warning is flagged on the `SyncRun` and visible in the UI, enabling the user to easily search the catalog and link the asset.

---

### 5.7 API & UI Exposure

- **GraphQL Schema**:
  - `registerSyncCredential(provider: String!, credentials: JSON!): SyncCredential!`
  - `generateAggregatorLink(provider: String!, redirectUrl: String!): AggregatorAuthSession!`
  - `completeAggregatorAuth(connectionId: ID!, sessionToken: String!): [SyncConnection!]!`
  - `linkSyncAccount(connectionId: ID!, accountId: ID!, autoCreate: Boolean): SyncConnection!`
  - `triggerAccountSync(accountId: ID!): SyncRun!`
  - `syncConnections(portfolioId: ID): [SyncConnection!]!`
- **Frontend UI**:
  - **Settings > Integrations**: Configure provider credentials (Kraken API key/secret, SnapTrade configuration).
  - **Account Dialog / View**: "Connect Institution" action launching OAuth/aggregator flow or direct credential modal. Supports auto-creating or linking existing accounts.
  - **Account List / Detail**: Display sync status pill (`Synced 5m ago`, `Syncing`, `Error`), with a "Sync Now" button.

---

## 6. What's Left to the Builder

The following technical implementation details are left to builder discretion:
- Specific rate limiting and backoff parameters for external API calls (e.g. Kraken API rate counter).
- Background worker polling interval (default: 6 hours with jitter).
- Detailed pagination cursor structure for ledger history.
- UI toast notification details and loading skeleton components.
