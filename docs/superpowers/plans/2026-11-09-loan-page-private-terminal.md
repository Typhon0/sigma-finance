# Loans Page Private Terminal Impeccable Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the Loans page (`/_app/assets/loans`, `LoansList.tsx`), detail view (`LoanDetail.tsx`), and creation form (`AddLoanForm.tsx`) into the institutional "Private Terminal" design system shared with Stocks, Crypto, and Accounts — featuring a 70/30 hero layout (`AssetHeroChart` + `LoansExposureWidget`), clean header without heavy banners, a 2-tab segmented workspace (compact debt ledger + detailed holdings/amortization), a slide-over `Sheet` for loan details, zero synthetic data (`Math.random()`), and **full end-to-end database persistence for all 25 fields of the loan creation form** (linking steps, linked asset collateral with LTV%, ownership percentage, co-owners, and company owners).

**Architecture:**
- **Database & Go Backend Layer:** Extend `LoanMetadata` (`server/internal/domain/model/asset.go`) to store previously unlinked form fields in PostgreSQL `metadata` JSONB (`linked_asset_ids`, `ownership_percentage`, `co_owners`, `company_owners`, `steps`). Update GraphQL schema (`asset.graphqls`), regenerate Go models with `gqlgen`, and handle cents conversion and unmarshaling in `CreateLoanAsset` and `mapLoanToGQL`.
- **Client Data Layer & Mutations:** Update `CreateLoanAsset` mutation, `useAssetMutations().addLoan`, `GET_DASHBOARD_CRITICAL` (`... on Loan` fragment), and `PortfolioProvider.tsx` (`extractLoanFields`) so all 25 form fields travel from `AddLoanForm` to the database and back into `PortfolioAssetItem`.
- **Form UI & Validation (`AddLoanForm.tsx`):** Preserve 100% of the 6-step form flow (Information, Characteristics, Fees & Costs, Steps, Linked Assets, Ownership & Co-owners), styled in Private Terminal standards (1px hairlines, mono numerals, auto-calculated values from `computeLoanAmortization`).
- **Analytics & Math:** Centralize deterministic loan formulas in `loan-calculator.ts` (`computeFullAmortizationSchedule`, `computePortfolioDebtSummary`, weighted average interest rate WAC) with zero `Math.random()` or hardcoded 5% / 120-month fallbacks.
- **UI & Layout:** Construct a 70/30 hero section (`AssetHeroChart` tracking positive outstanding debt + `LoansExposureWidget` for debt structure & debt service burden), interactive in-viewport cross-filter banner, 2-tab workspace with table density toggle, and a right slide-over `Sheet` with hybrid annual/monthly amortization table.

**Tech Stack:** Go 1.25, Bun ORM / PostgreSQL JSONB, gqlgen, React 19, TypeScript, TanStack Router, Apollo Client / GraphQL, Tailwind CSS, Radix UI / ShadCN (`Sheet`, `Dialog`, `Select`, `Table`, `Badge`), Lucide Icons, Framer Motion, Vitest.

**Spec:** User request aligned via `/grill-me` (5 locked architectural decisions), `DESIGN.md` ("The Private Terminal"), `PRODUCT.md`, and previous overhauls recorded in Hindsight memory (`kp-fd01885eb3184a5eae64af276604382f` - Accounts Overhaul, `kp-99ca9ada90a5400e8e38f332d5a9dc65` - Stocks Overhaul, `kp-5ed2d90bfc2f472ebe4097fbdfbba282` - Loans Overhaul Initiative).

## Locked Design Decisions (Aligned via /grill-me)

1. **Hero Chart Trajectory:** Positive outstanding balance scale (`€180k`), descending over time as loan principal is paid down, accompanied by delta indicators showing amortized reduction.
2. **Interactive Cross-Filtering:** Clicking any category in the 30% `LoansExposureWidget` triggers complete cross-filtering across both workspace tabs ("Debt Ledger" and "Holdings & Amortization"), rendering the animated in-viewport banner with pulse dot, count, value, "Jump to Ledger", and "Clear".
3. **Amortization Schedule in Slide-Over:** Hybrid view presenting an annual summary by default (Year 1, Year 2... with capital, interest, and end-of-year balance) with an instant toggle to a full month-by-month table (12 to 300 months) including search by period.
4. **Linked Collateral / Assets:** Rendered as interactive badges with automated Loan-to-Value calculation (e.g. `🏠 Villa Hossegor • 72% LTV`) and direct one-click navigation to the underlying asset.
5. **Ownership Prorata & Double Reading:** Net debt obligations and monthly payments are computed strictly according to the user's `ownershipPercentage` (e.g. 50% = €90k debt), displayed alongside a clear subtitle indicating the total gross liability (€180k).
6. **Form & DB Persistence:** 100% of all 25 fields in `AddLoanForm` preserved and saved directly to PostgreSQL `assets.metadata` JSONB.

## Global Constraints

- **Form Integrity Rule:** All fields and 6 steps in `AddLoanForm.tsx` must remain intact. Every piece of information entered by the user must be persisted in PostgreSQL `assets.metadata` JSONB and returned via GraphQL.
- **The Money-Only Color Rule:** Saturated color appears only where it carries financial or status meaning (`text-gain`, `text-loss`, `text-warning`, badges). Chrome, navigation, headers, and tabs stay near-achromatic ink-and-paper.
- **The Hairline-First Rule:** Structure at rest uses 1px `--border` (white at 10% in dark theme). Cards and panels never carry drop shadows at rest. Shadows only exist on floating layers (dropdowns, dialogs, slide-over sheets).
- **The 11px Floor Rule:** Labels never render below 0.6875rem (11px, `--text-micro`).
- **The Numerals Rule:** Money and percentages use mono font stack (`font-mono tabular-nums`), KPI values at 24px/700.
- **Zero Fake Data:** Absolutely no `Math.random()`, fake sine waves, hardcoded 5.0% interest rates, or defaulted 120 months. All schedules, payments, and balances are derived deterministically from real portfolio asset data.
- **Container Rebuild:** Rebuild and recreate backend container after backend modifications: `docker compose build server && docker compose up -d server`.

## Review Focus

1. **Full Form Field Persistence in Database:** When adding a loan with step schedule, linked assets (e.g. real estate), co-owners, or company ownership, all data is saved in DB and retrieved without truncation.
2. **Double-Reading Net vs Gross Debt:** Verification that a 50% co-owned loan computes the user's net personal debt accurately while displaying the total gross commitment.
3. **Hybrid Amortization Table:** Check that annual aggregation sums interest and principal accurately matching the monthly breakdown, without rounding drift.
4. **Loan-to-Value (LTV%) Calculation:** Check that loans linked to assets compute `(loanRemainingBalance / assetCurrentValue) * 100` gracefully without division by zero.
5. **Slide-over Sheet Responsiveness:** The loan detail slide-over must be responsive on mobile and desktop (`w-full sm:max-w-2xl overflow-y-auto p-0`), closing gracefully on escape or backdrop click.

---

### Task 1: Complete Backend & Database Field Wiring for Loans

**Files:**
- Modify: `server/internal/domain/model/asset.go:170-205`
- Modify: `server/internal/handler/graphql/schema/asset.graphqls:195-235, 410-440`
- Modify: `server/internal/handler/graphql/schema.resolvers.go:840-920`
- Modify: `server/internal/handler/graphql/converter.go:480-550`

- [ ] **Step 1:** In `server/internal/domain/model/asset.go`, extend `LoanMetadata` to include:
  ```go
  type LoanStepMetadata struct {
      ID           string  `json:"id"`
      Date         string  `json:"date,omitempty"`
      Amount       int64   `json:"amount"` // in cents
      InterestRate float64 `json:"interest_rate"`
  }

  type CoOwnerMetadata struct {
      ID         string  `json:"id"`
      Type       string  `json:"type"` // registered, custom
      UserID     *string `json:"user_id,omitempty"`
      Name       string  `json:"name"`
      Percentage float64 `json:"percentage"`
  }

  type CompanyOwnerMetadata struct {
      ID                 string  `json:"id"`
      Type               string  `json:"type"` // existing, new
      CompanyID          *string `json:"company_id,omitempty"`
      Name               string  `json:"name"`
      RegistrationNumber string  `json:"registration_number,omitempty"`
      LegalForm          string  `json:"legal_form,omitempty"`
      Percentage         float64 `json:"percentage"`
  }
  ```
  Add `LinkedAssetIDs []string`, `OwnershipPercentage *float64`, `CoOwners []CoOwnerMetadata`, `CompanyOwners []CompanyOwnerMetadata`, `Steps []LoanStepMetadata` to `LoanMetadata`.
- [ ] **Step 2:** In `server/internal/handler/graphql/schema/asset.graphqls`:
  - Define GraphQL types `LoanStep`, `LoanCoOwner`, `LoanCompanyOwner` and inputs `LoanStepInput`, `LoanCoOwnerInput`, `LoanCompanyOwnerInput`.
  - Add fields `linkedAssetIDs: [ID!]`, `ownershipPercentage: Float`, `coOwners: [LoanCoOwner!]`, `companyOwners: [LoanCompanyOwner!]`, `steps: [LoanStep!]` to `type Loan implements Asset` and to `input CreateLoanInput`.
- [ ] **Step 3:** Run `gqlgen` code generation:
  `cd server && go run github.com/99designs/gqlgen generate`
- [ ] **Step 4:** In `server/internal/handler/graphql/schema.resolvers.go` (`CreateLoanAsset`):
  - Read `input.LinkedAssetIDs`, `input.OwnershipPercentage`, `input.CoOwners`, `input.CompanyOwners`, `input.Steps`.
  - Convert `Step.Amount` to cents (`int64(s.Amount * 100)`).
  - Marshal all fields into `metadataBytes` to persist in `asset.Metadata` (JSONB).
- [ ] **Step 5:** In `server/internal/handler/graphql/converter.go` (`mapLoanToGQL`):
  - Map `LinkedAssetIDs`, `OwnershipPercentage`, `CoOwners`, `CompanyOwners`, `Steps` to `gqlModel.Loan`.
  - Ensure fallback to `&remainingBalance` when `currentValue == nil` and fallback to `&loanAmount` when `domainAsset.PurchasePrice == nil`.
- [ ] **Step 6:** Run server build / test to verify Go compiles cleanly:
  `cd server && go test ./internal/handler/graphql/...`
- [ ] **Step 7:** Commit backend changes:
  `git commit -m "feat(server): wire all loan metadata fields into database and GraphQL schema"`

---

### Task 2: Client GraphQL Mutations, Queries & PortfolioProvider Integration

**Files:**
- Modify: `client/src/graphql/mutations/asset.ts:155-170`
- Modify: `client/src/graphql/queries/dashboard.ts:75-108`
- Modify: `client/src/hooks/use-asset-mutations.ts:110-140, 735-775`
- Modify: `client/src/components/PortfolioProvider.tsx:30-100, 310-370`

- [ ] **Step 1:** In `client/src/graphql/mutations/asset.ts`, update `CreateLoanAsset` mutation document to send all fields:
  `linkedAssetIDs`, `ownershipPercentage`, `coOwners`, `companyOwners`, `steps`.
- [ ] **Step 2:** In `client/src/graphql/queries/dashboard.ts`, update `GET_DASHBOARD_CRITICAL` to query all loan fields in `... on Loan`:
  `loanType`, `loanAmount`, `remainingBalance`, `interestRate`, `durationMonths`, `monthlyPayment`, `startDate`, `endDate`, `lender`, `loanNumber`, `currency`, `downPayment`, `status`, `ownershipMode`, `applicationFee`, `brokerFee`, `insuranceFee`, `otherFees`, `earlyRepaymentFee`, `linkedAssetIDs`, `ownershipPercentage`, `coOwners`, `companyOwners`, `steps`.
- [ ] **Step 3:** Run GraphQL code generation on client:
  `npm --prefix client run codegen`
- [ ] **Step 4:** In `client/src/hooks/use-asset-mutations.ts`:
  - Extend `AddLoanInput` to include `linkedAssetIDs`, `ownershipPercentage`, `coOwners`, `companyOwners`, `steps`.
  - In `addLoan`, pass all fields to `createLoanAsset({ variables: { input: loanInput } })`.
- [ ] **Step 5:** In `client/src/components/PortfolioProvider.tsx`:
  - Update `PortfolioAssetItem` with all loan fields.
  - Implement `extractLoanFields` to map loan properties onto `PortfolioAssetItem`.
  - Include `...extractLoanFields(a.asset)` in `mappedAssets`.
- [ ] **Step 6:** Run client typecheck to confirm:
  `npm --prefix client run typecheck`
- [ ] **Step 7:** Commit client data layer changes:
  `git commit -m "feat(client): update GraphQL mutations and PortfolioProvider for complete loan models"`

---

### Task 3: Deterministic Loan Math, Hybrid Schedules & LTV in `loan-calculator.ts`

**Files:**
- Modify: `client/src/lib/loan-calculator.ts`
- Modify: `client/src/lib/__tests__/loan-calculator.test.ts`

- [ ] **Step 1:** Write unit tests in `client/src/lib/__tests__/loan-calculator.test.ts` for:
  - `computeFullAmortizationSchedule`: month-by-month periodic entries and aggregated annual summary entries (`AnnualAmortizationSummary`).
  - `computePortfolioDebtSummary`: total gross debt, total net personal debt (applying `ownershipPercentage`), total monthly debt service, weighted average interest rate (WAC), total principal paid, amortized ratio, and estimated remaining interest.
  - `computeLoanToValue`: calculate LTV percentage given remaining debt and linked asset current value.
- [ ] **Step 2:** Run test to verify failure prior to implementation:
  `npm --prefix client run test -- --run src/lib/__tests__/loan-calculator.test.ts`
- [ ] **Step 3:** Implement `computeFullAmortizationSchedule`, `computeAnnualAmortizationSummary`, `computeLoanToValue`, and `computePortfolioDebtSummary` in `client/src/lib/loan-calculator.ts`.
- [ ] **Step 4:** Run test to verify passing:
  `npm --prefix client run test -- --run src/lib/__tests__/loan-calculator.test.ts`
- [ ] **Step 5:** Commit changes:
  `git commit -m "feat(loans): implement deterministic hybrid schedule generator and LTV calculations"`

---

### Task 4: Polish & Connect `AddLoanForm.tsx` (Preserving 100% of Form Data)

**Files:**
- Modify: `client/src/components/assets/loans/AddLoanForm.tsx`
- Modify: `client/src/components/assets/loans/LoansList.tsx:180-256`

- [ ] **Step 1:** In `AddLoanForm.tsx`, ensure all 6 steps are preserved and styled cleanly according to Private Terminal:
  - Step 1: Information (name, type, loanAmount, downPayment, currency, description).
  - Step 2: Characteristics (interestRate, duration, startDate, endDate, monthlyPayment, remainingBalance, bank, loanNumber).
  - Step 3: Fees & Costs (applicationFee, brokerFee, insuranceFee, otherFees, earlyRepaymentFee).
  - Step 4: Steps (for step loans: date, amount, interestRate).
  - Step 5: Linked assets (selection from real portfolio assets).
  - Step 6: Ownership (mode toggle, ownership percentage, co-owners, company owners).
  - Inputs with 1px hairlines, `--radius-md`, mono numerals for monetary amounts, accessible dialog with backdrop.
- [ ] **Step 2:** In `LoansList.tsx` inside `handleAddLoan`:
  - Ensure the full payload from `AddLoanForm` (including `steps`, `linkedAssetIds`, `ownershipPercentage`, `coOwners`, `companyOwners`) is passed to `addLoan(input)` without stripping any fields.
- [ ] **Step 3:** Verify typecheck:
  `npm --prefix client run typecheck`
- [ ] **Step 4:** Commit form changes:
  `git commit -m "feat(loans): connect AddLoanForm end-to-end preserving all fields and steps"`

---

### Task 5: Implement 30% Rail Widget (`LoansExposureWidget.tsx`)

**Files:**
- Create: `client/src/components/assets/loans/LoansExposureWidget.tsx`

- [ ] **Step 1:** Create `LoansExposureWidget.tsx`:
  - **Header:** "DEBT STRUCTURE" (`text-[11px] font-bold uppercase tracking-wider text-foreground`).
  - **Category Segmented Bar:**
    - Categories: Mortgage (Immobilier), Consumer (Personnel), Auto, Student (Étudiant), In-Fine, Step (Palier).
    - Animated progress bar with distinct palette colors from `DESIGN.md`.
    - Category list rows with count, amount, % of total debt.
    - Clickable category row to trigger interactive cross-filtering on the workspace.
  - **Key Debt Metrics:**
    - Weighted Average Interest Rate (WAC / Taux moyen pondéré).
    - Total Monthly Debt Service (Mensualité globale engagée / Cash Drag) with net vs gross display.
    - Principal Amortized % (% capital amorti).
    - Average remaining duration or horizon.
    - Currency breakdown (EUR, USD, etc.).
- [ ] **Step 2:** Check styling compliance (1px hairline borders, no resting shadows, mono numbers, 11px floor).
- [ ] **Step 3:** Run typecheck:
  `npm --prefix client run typecheck`
- [ ] **Step 4:** Commit changes:
  `git commit -m "feat(loans): create LoansExposureWidget for debt structure and service brief"`

---

### Task 6: Re-engineer `LoanDetail.tsx` for Slide-over Sheet (Zero Fake Data & Hybrid Table)

**Files:**
- Modify: `client/src/components/assets/loans/LoanDetail.tsx`

- [ ] **Step 1:** Remove all synthetic / placeholder data and comments (`Math.random()`, hardcoded `5.0%` interest rate, hardcoded `120 months`, `// TODO: Replace with loan-specific fields`).
- [ ] **Step 2:** Connect `LoanDetail` directly to real loan fields from `PortfolioAssetItem` in `usePortfolio()`.
- [ ] **Step 3:** Structure `LoanDetail` for slide-over `Sheet` presentation:
  - **Header:** Loan title, lender badge, loan type badge, status badge (`active`, `paid-off`, `delinquent`), delete button with confirmation dialog, close button.
  - **4 KPI Cards Grid:**
    1. Outstanding Balance (Solde restant dû net + brut)
    2. Monthly Payment (Mensualité avec/sans assurance)
    3. Nominal Interest Rate (Taux nominal %)
    4. Estimated Remaining Total Interest (Intérêts restants)
  - **Amortization Progress Bar:** Visual progress of debt paid off (`% amortized`), start date, months elapsed, months remaining, calculated maturity date.
  - **Characteristics Card:** Original Loan Amount, Down Payment (Apport), Total Duration, Loan Reference Number, Ownership Mode (Personal vs Company), Ownership percentage.
  - **Fees & Insurance Card:** Monthly Insurance, Application Fee, Broker Fee, Early Repayment Fee (IRA) when present.
  - **Linked Assets Collateral Section:** Display linked assets with LTV% (e.g. `🏠 Villa Hossegor • 72% LTV`) and navigation link.
  - **Co-Owners & Company Ownership Section:** Display co-owners with percentage shares and company entity details.
  - **Step Schedule Section (if step loan):** List of steps with dates, amounts, and rates.
  - **Hybrid Amortization Schedule Table:** Annual summary by default with annual capital, interest, and end-of-year balance, with toggle to view month-by-month table and period search filter.
- [ ] **Step 4:** Run typecheck:
  `npm --prefix client run typecheck`
- [ ] **Step 5:** Commit changes:
  `git commit -m "feat(loans): re-engineer LoanDetail for slide-over sheet with hybrid table and LTV collateral"`

---

### Task 7: Overhaul `LoansList.tsx` into Private Terminal 70/30 & 2-Tab Workspace

**Files:**
- Modify: `client/src/components/assets/loans/LoansList.tsx`

- [ ] **Step 1:** In `LoansList.tsx`, clean up header and remove cluttered components:
  - Use `AssetPageHeader` with title "Loans & Debt", clean subtitle, "+ Add Loan" primary button.
  - Add clean header summary pills (Total Debt, Monthly Service, Avg Rate, Active Loans) with net personal vs total gross dual readout.
  - REMOVE `BenchmarkMetricsBar` (S&P 500 comparison on debt removed).
  - REMOVE 4 generic legacy cards.
- [ ] **Step 2:** Implement the 70/30 Hero Grid:
  - Left 70%: `<AssetHeroChart title="Total Debt Outstanding" titleTooltip="Aggregated debt obligations and amortization history" data={performanceData} holdings={chartHoldings} totalEquity={totalDebt} formatCurrency={formatCurrency} timeRange={timeRange} onTimeRangeChange={setTimeRange} portfolioID={selectedPortfolio?.id} defaultBenchmark="none" layoutId="loansHeroRangePillActive" />`
  - Right 30%: `<LoansExposureWidget totalDebt={totalDebt} totalOriginalAmount={totalOriginalAmount} loans={loans} activeCategoryFilter={activeCategoryFilter} onSelectCategory={setActiveCategoryFilter} formatCurrency={formatCurrency} />`
- [ ] **Step 3:** Implement In-Viewport Active Cross-Filter Banner:
  - Framer Motion banner with category color pulse, category label, count, amount, % of total debt, "Jump to Ledger" scroll button, and "Clear" button.
- [ ] **Step 4:** Implement 2-Tab Segmented Workspace:
  - Tab 1: **"Debt Ledger"** (ledger compact)
    - High-density table with density toggle (`compact` vs `normal`) persisted in `localStorage`.
    - Search input, loan type filter, status filter, sort dropdown.
    - Columns: Loan & Lender, Linked Asset & LTV%, Ownership & Share, Outstanding Balance, Original Amount & Repaid %, Interest Rate, Monthly Payment, Remaining Duration / Maturity, Status Badge, Actions.
    - Clicking a row opens the slide-over Sheet.
  - Tab 2: **"Holdings & Amortization"** (holdings détaillées)
    - Detailed loan cards: capital amorti vs restant, total interest estimated over loan life, monthly principal vs interest split, collateral/linked assets with LTV%, fees breakdown.
- [ ] **Step 5:** Implement Slide-over Sheet:
  - `<Sheet open={Boolean(selectedLoanId)} onOpenChange={(open) => !open && setSelectedLoanId(null)}>`
  - `<SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">`
  - `<LoanDetail loanId={selectedLoanId} onBack={() => setSelectedLoanId(null)} isPanel />`
- [ ] **Step 6:** Delete loan confirmation dialog integration (`deleteAsset` from `usePortfolio()`).
- [ ] **Step 7:** Run typecheck:
  `npm --prefix client run typecheck`
- [ ] **Step 8:** Commit changes:
  `git commit -m "feat(loans): overhaul LoansList into Private Terminal 70/30 layout and 2-tab workspace"`

---

### Task 8: Automated Vitest Test Suite & Impeccable Mechanical Detector

**Files:**
- Create: `client/src/components/__tests__/LoansList-actions.test.tsx`

- [ ] **Step 1:** Create `client/src/components/__tests__/LoansList-actions.test.tsx`:
  - Test 1: Renders debt ledger with real balances, interest rates, and monthly payments.
  - Test 2: Renders 70/30 hero section with `AssetHeroChart` and `LoansExposureWidget`.
  - Test 3: Switches between "Debt Ledger" and "Holdings & Amortization" tabs.
  - Test 4: Cross-filters ledger when clicking category in exposure widget, showing active cross-filter banner.
  - Test 5: Displays linked assets with calculated LTV%.
  - Test 6: Opens slide-over `Sheet` when clicking a loan row with hybrid amortization view.
  - Test 7: Verifies `AddLoanForm` submission with all 25 fields.
  - Test 8: Opens delete confirmation dialog and triggers `deleteAsset`.
- [ ] **Step 2:** Run vitest test suite:
  `npm --prefix client run test -- --run src/components/__tests__/LoansList-actions.test.tsx`
- [ ] **Step 3:** Run client production build:
  `npm --prefix client run build`
- [ ] **Step 4:** Run Impeccable mechanical detector:
  `.agents/skills/impeccable/scripts/impeccable detect --json client/src/components/assets/loans/LoansList.tsx client/src/components/assets/loans/LoanDetail.tsx client/src/components/assets/loans/LoansExposureWidget.tsx client/src/components/assets/loans/AddLoanForm.tsx`
- [ ] **Step 5:** Rebuild & recreate backend container:
  `docker compose build server && docker compose up -d server`
- [ ] **Step 6:** Commit changes:
  `git commit -m "test(loans): add vitest actions suite and verify impeccable detector compliance"`
