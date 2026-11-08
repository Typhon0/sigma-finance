# Accounts Page Functional Fix & Multi-Currency Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore accurate live balances and rich interactive account details on `/assets/accounts` across all 17 accounts (Revolut multi-currency pockets, Trade Republic, Kraken, on-chain wallets), supporting native currency balances, EUR estimated conversions, an empty accounts toggle, and a slide-over Sheet for account details.

**Architecture:** 
1. **Backend Repository (`account_repo.go`)**: Eagerly load `Positions`, `Positions.Asset`, and `SyncConnection` in `GetAccountsByPortfolioID`, `GetAccountsByUserID`, and `GetByID` using table aliases (`a.portfolio_id`, `a.user_id`, `a.id`) to eliminate PostgreSQL `column reference "portfolio_id" is ambiguous` errors.
2. **Backend GraphQL Resolver (`account.resolvers.go`)**: Batch-fetch latest prices via `AssetPrice().GetLatestPrices` for all holdings across accounts, and compute live market & cash valuations with `mapAccountToGQLWithPrices`.
3. **Frontend Presentation (`AccountsList.tsx`)**:
   - Primary balance formatted in account native currency (`formatCurrency(account.totalValue, account.currency)`).
   - Subtitle estimated conversion to portfolio display currency (EUR) if account currency != EUR.
   - Prominent currency badges (`EUR`, `USD`, `JPY`, `INR`, etc.) and account number / IBAN subtext.
   - Top KPI cards aggregated in EUR using portfolio FX rates.
   - "Hide empty accounts" toggle switch in toolbar.
4. **Frontend Detail Sheet (`_app.assets.accounts.lazy.tsx` & `AccountDetail.tsx`)**:
   - Slide-over Sheet panel when clicking an account card or "View Details", consistent with `StockDetail` in `StocksFundsModule`.
   - Remove fake `Math.random()` in `AccountDetail.tsx`.

**Tech Stack:** Go 1.23, Bun ORM, GraphQL (gqlgen), React, Apollo Client, Radix UI Sheet, Tailwind CSS.

---

## Global Constraints

- Do not modify or drop database check constraints or schema tables.
- Respect table alias `a` for `sigma_finance.accounts` in all Bun SQL queries to prevent `column reference "portfolio_id" is ambiguous`.
- Adhere to the Minimal Diff Principle: clean, surgical updates.
- Always rebuild and recreate the backend container (`docker compose build server && docker compose up -d server`) after backend changes.

## Review Focus

1. **Revolut Multi-Currency Accounts**: USD ($0.40), INR (₹41.33), JPY (¥4), EUR (€4,433.22) must display native currency symbols and proper decimal precision.
2. **EUR Conversion Subtitles**: Non-EUR accounts must show estimated EUR conversion (e.g. `≈ 0.37 €`) based on portfolio FX rates.
3. **Trade Republic & Kraken Accounts**: Portfolios with tradeable assets must compute live market value (`quantity * latest_price` + cash balance).
4. **Empty Accounts Toggle**: The toolbar switch must toggle visibility of 0-balance accounts with a counter ("Showing 10 of 17 accounts (7 empty hidden)").
5. **Slide-Over Sheet**: Clicking any account card must smoothly open `AccountDetail` in a right-sliding Sheet with full holdings, sync triggers, and close/escape handling.

---

### Task 1: Repository Relation Loading with Ambiguous Column Protection

**Files:**
- Modify: `server/internal/repository/account_repo.go:43-62`
- Test: `server/internal/repository/account_repo_test.go`

**Interfaces:**
- Consumes: `bun.IDB`
- Produces: `GetAccountsByPortfolioID`, `GetAccountsByUserID`, and `GetByID` with populated `Positions`, `Positions.Asset`, and `SyncConnection`.

- [ ] **Step 1: Write test asserting relations are loaded on `GetAccountsByPortfolioID`**
  - Verify that `Positions` and `SyncConnection` are loaded and SQL queries qualify `a.portfolio_id`.

- [ ] **Step 2: Run test to observe failure**
  ```bash
  go test -C server -v -run TestAccountRepository_GetAccountsByPortfolioID_WithRelations ./internal/repository/...
  ```

- [ ] **Step 3: Update `account_repo.go`**
  ```go
  func (r *AccountRepository) GetAccountsByPortfolioID(ctx context.Context, portfolioID string) ([]model.Account, error) {
      var accounts []model.Account
      err := r.db.NewSelect().
          Model(&accounts).
          Where("a.portfolio_id = ?", portfolioID).
          Relation("Positions").
          Relation("Positions.Asset").
          Relation("SyncConnection").
          Order("a.created_at ASC").
          Scan(ctx)
      if err != nil {
          return nil, err
      }
      return accounts, nil
  }

  func (r *AccountRepository) GetAccountsByUserID(ctx context.Context, userID string) ([]model.Account, error) {
      var accounts []model.Account
      err := r.db.NewSelect().
          Model(&accounts).
          Where("a.user_id = ?", userID).
          Relation("Positions").
          Relation("Positions.Asset").
          Relation("SyncConnection").
          Order("a.created_at ASC").
          Scan(ctx)
      if err != nil {
          return nil, err
      }
      return accounts, nil
  }

  func (r *AccountRepository) GetByID(ctx context.Context, id string) (*model.Account, error) {
      acc := new(model.Account)
      err := r.db.NewSelect().
          Model(acc).
          Where("a.id = ?", id).
          Relation("Positions").
          Relation("Positions.Asset").
          Relation("SyncConnection").
          Scan(ctx)
      if err != nil {
          if errors.Is(err, sql.ErrNoRows) {
              return nil, ErrNotFound
          }
          return nil, err
      }
      return acc, nil
  }
  ```

- [ ] **Step 4: Run repository tests**
  ```bash
  go test -C server -v ./internal/repository/...
  ```

---

### Task 2: GraphQL Resolvers Live Price & Valuation Mapping

**Files:**
- Modify: `server/internal/handler/graphql/account.resolvers.go:94-134`
- Test: `server/internal/handler/graphql/account_resolvers_test.go`

**Interfaces:**
- Consumes: `r.AccountService`, `r.UOW.AssetPrice().GetLatestPrices`
- Produces: `gqlModel.Account` with non-zero `totalValue`, `positionsCount`, and `syncConnection`.

- [ ] **Step 1: Update `Accounts` and `Account` resolvers in `account.resolvers.go`**
  - Collect all distinct `AssetID`s across `accounts.Positions`.
  - Batch fetch latest prices:
    ```go
    priceMap := make(map[string]float64)
    if len(assetIDs) > 0 {
        latestPrices, err := r.UOW.AssetPrice().GetLatestPrices(ctx, assetIDs)
        if err == nil {
            for _, lp := range latestPrices {
                p, _ := lp.Price.Float64()
                priceMap[lp.AssetID] = p
            }
        }
    }
    ```
  - Map accounts using `mapAccountToGQLWithPrices(a, priceMap)`.

- [ ] **Step 2: Run GraphQL resolver tests**
  ```bash
  go test -C server -v ./internal/handler/graphql/...
  ```

---

### Task 3: Frontend Multi-Currency Formatting, Badges & Empty Accounts Toggle

**Files:**
- Modify: `client/src/components/AccountsList.tsx`

**Interfaces:**
- Consumes: `account.totalValue`, `account.currency`, `account.syncConnection`
- Produces: Native currency formatting, estimated EUR conversion subtitle, currency badges, and empty accounts filter switch.

- [ ] **Step 1: Add "Hide empty accounts" switch state and filter logic**
  - Add state `const [hideEmptyAccounts, setHideEmptyAccounts] = useState(false)`.
  - Filter accounts with `totalValue === 0 && hideEmptyAccounts`.
  - Render toggle in filter toolbar with count indicator ("Showing X of Y accounts").

- [ ] **Step 2: Update currency formatting & badges**
  - Format native balance: `{formatCurrency(account.totalValue, account.currency)}`.
  - Display currency badge: `<Badge variant="outline">{account.currency}</Badge>`.
  - If `account.currency !== userCurrency && account.totalValue > 0`, calculate and render estimated EUR equivalent: `≈ {formatCurrency(convertedEUR)}`.
  - Top KPI Total Value: Compute converted EUR total using portfolio FX resolutions.

- [ ] **Step 3: Run client unit tests**
  ```bash
  npm --prefix client test src/components/__tests__/AccountsList-actions.test.tsx
  ```

---

### Task 4: Slide-Over Sheet for AccountDetail & Placeholder Removal

**Files:**
- Modify: `client/src/components/AccountsList.tsx` (or `_app.assets.accounts.lazy.tsx`)
- Modify: `client/src/components/AccountDetail.tsx`

**Interfaces:**
- Consumes: `selectedAccountId`
- Produces: Sheet slide-over panel on card click or "View Details", and real `dayChangePercent` values.

- [ ] **Step 1: Wrap `AccountDetail` in a slide-over `<Sheet>`**
  - State: `const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)`.
  - Wire `onSelectAccount={(id) => setSelectedAccountId(id)}`.
  - Add `<Sheet open={!!selectedAccountId} onOpenChange={(open) => !open && setSelectedAccountId(null)}>` containing `<AccountDetail accountId={selectedAccountId!} onBack={() => setSelectedAccountId(null)} />`.

- [ ] **Step 2: Clean up mock code in `AccountDetail.tsx`**
  - Remove `Math.random() * 5 * ...` at line 121 and use `h.dayChangePercent ?? null`.

- [ ] **Step 3: Run client test suite**
  ```bash
  npm --prefix client test
  ```

---

### Task 5: Build, Restart, and Live Verification

**Files:**
- N/A

- [ ] **Step 1: Rebuild and restart server container**
  ```bash
  docker compose build server && docker compose up -d server
  ```

- [ ] **Step 2: Live browser & API verification**
  - Query `GetAccounts` GraphQL to confirm live non-zero values for funded accounts.
  - Test UI on `https://sigmafinance.typhon0.com/assets/accounts`:
    - Check EUR, USD, INR, JPY balances with native currency symbols.
    - Check "Hide empty accounts" toggle.
    - Click an account to test slide-over Sheet.
