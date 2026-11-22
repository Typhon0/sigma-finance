# Insurance "Private Terminal" Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Insurance & Retirement page (`client/src/components/assets/insurance/InsuranceList.tsx`) with the "Private Terminal" design system matching Stocks, Crypto, and Accounts: 70/30 hero section (`AssetHeroChart` + `InsuranceExposureWidget`), clean header without heavy banners, 2-tab workspace (compact ledger + detailed holdings), adaptive split-screen details pane and slide-over sheet, and zero fake data (`Math.random`).

**Architecture:**
- **Data Layer**: Augment GraphQL `GET_DASHBOARD_CRITICAL` with `... on LifeInsurance` inline fragment and implement `extractLifeInsuranceFields` in `PortfolioProvider.tsx` to extract genuine domain properties (`policyNumber`, `insurer`, `policyType`, `coverageAmount`, `premiumAmount`, `premiumFrequency`, `beneficiaries`, `maturityDate`).
- **70/30 Hero Section**:
  - Left 70%: `AssetHeroChart` connected to `GET_SCOPED_PERFORMANCE_HISTORY` (scoped to `["LIFE_INSURANCE"]`), showing real surrender equity and period performance without smoothing.
  - Right 30%: `InsuranceExposureWidget` with toggle between "By Insurer" (counterparty concentration) and "By Type" (Assurance-vie, PER, Capitalisation, Prévoyance), plus summary cards for **Capital Garanti** (`totalCoverage`) and **Charge Annuelle de Cotisations** (`annualPremiumBurden`).
- **In-Viewport Cross-Filter Banner**: Interactive slice selection in the 30% widget filters the workspace and displays an animated banner with jump-to-ledger and clear actions.
- **2-Tab Workspace**:
  - Tab 1: **Insurance Ledger**: High-density table with density toggle (`compact` / `normal` in localStorage), instant multi-field search (name, insurer, policy #), category selector, and multi-criteria sorting.
  - Tab 2: **Holdings détaillées**: Enriched contract view grouped by Insurer or Policy Type, detailing key contract clauses (designated beneficiaries, maturity date, capital invested vs cash surrender value vs guaranteed death coverage ratio, tax wrapper status).
- **Adaptive Details Affordance**:
  - Desktop: When a policy is selected, display a responsive split-screen layout (60% list / 40% docked Details Pane) so the user never loses their ledger context.
  - Mobile/narrow screens: Display a slide-over `Sheet` modal (`SheetContent side="right"`).
- **Zero Fake Data (`Math.random`)**: Eliminate the synthetic EChart curve in `InsuranceDetail.tsx`. Replace with an authentic multi-pillar benchmark gauge (`Capital Versé` vs `Valeur de Rachat` vs `Capital Garanti`) and explicit "Last Valued At" date stamp. Format all amounts using `useCurrency()`.

**Tech Stack:** React 19, TypeScript, Apollo Client 3.14, TanStack Router, Framer Motion 12, Tailwind CSS (OKLCH tokens), Vitest, Testing Library.

**Spec:** Directives aligned through user interview (`/grill-me`):
1. Split-screen adaptatif (Desktop 60/40 docked Details Pane, Mobile/tablet Slide-over Sheet).
2. Widget Hybride "Exposition & Engagements" (Insurer / Category toggle + Total Coverage + Annual Outflow burden).
3. Workspace Tab 2 "Holdings détaillées" groupée par assureur/type avec clauses approfondies.
4. Règle d'honnêteté des données : aucune courbe synthétique, jauge comparative réelle à 3 piliers dans le panneau de détails.
5. Barre d'outils complète : Recherche instantanée, filtre catégorie, tri multicritères, et basculeur de densité compact/normal persisté.

## Global Constraints

- **Financial Correctness**: Monetary values formatted via `useCurrency()` using localized currency tokens. No float rounding errors, no fabricated points.
- **Zero-Parametric Grounding**: Schema alignment with `server/internal/handler/graphql/schema/asset.graphqls` (`LifeInsurance` type).
- **Design Tokens**: Strict adherence to `DESIGN.md` OKLCH color tokens, `border-border/30`, `font-mono` for figures, `touch-target` accessibility standards (min 36-44px), and `useReducedMotion` support.
- **Testing**: Vitest unit test suite covering actions, filtering, tab switching, and sheet/pane opening without regressions.

## Review Focus

1. **LifeInsurance GraphQL Field Extraction**: Missing `... on LifeInsurance` in `GET_DASHBOARD_CRITICAL` would cause policy fields (`policyNumber`, `insurer`, `coverageAmount`, etc.) to default to undefined. Verify GraphQL fragment and `PortfolioProvider` extraction.
2. **Elimination of Fake Math**: `InsuranceDetail.tsx` previously used `[purchasePrice * 0.95, ... 1.05]` fake points. Verify all synthetic chart data is excised and replaced with authentic values or honest contract metrics.
3. **Adaptive Split-Screen / Sheet**: Verify that selecting a policy docks the details pane on wide desktop viewports (preserving ledger visibility) while opening the slide-over sheet on smaller screens.
4. **Active Cross-Filter Synchronization**: Clicking an insurer/category slice in `InsuranceExposureWidget` must immediately filter both the Ledger and Holdings views and display the interactive banner.
5. **Empty State & Error Resiliency**: Ensure empty portfolios or network query issues render clean empty/error states without broken metrics or NaN values.

---

### Task 1: Domain & GraphQL Query Integration for LifeInsurance

**Files:**
- Modify: `client/src/graphql/queries/dashboard.ts:180-230`
- Modify: `client/src/components/PortfolioProvider.tsx:80-350, 600-660`
- Test: `client/src/components/__tests__/portfolio-provider.test.tsx`

- [ ] **Step 1: Add LifeInsurance fragment to GET_DASHBOARD_CRITICAL**
  In `client/src/graphql/queries/dashboard.ts`, add the inline fragment on `LifeInsurance` inside `assets.asset`:
  ```graphql
  ... on LifeInsurance {
    policyNumber
    insurer
    policyType
    coverageAmount
    premiumAmount
    premiumFrequency
    beneficiaries
    maturityDate
  }
  ```

- [ ] **Step 2: Add extractLifeInsuranceFields in PortfolioProvider.tsx**
  In `client/src/components/PortfolioProvider.tsx`:
  - Extend `PortfolioAssetItem` interface with life insurance fields (`policyNumber`, `insurer`, `policyType`, `coverageAmount`, `premiumAmount`, `premiumFrequency`, `beneficiaries`, `maturityDate`).
  - Implement `extractLifeInsuranceFields(asset)` that checks `asset.__typename === "LifeInsurance"` or `asset.policyNumber !== undefined` or `asset.insurer !== undefined` and returns `{ type: "insurance", ... }`.
  - In `allAssets` mapping, call `extractLifeInsuranceFields(a.asset)` and merge it into the normalized asset, ensuring `type` is correctly set to `"insurance"`.

- [ ] **Step 3: Run existing portfolio provider tests to verify backward compatibility**
  Run: `npm --prefix client test -- --run src/components/__tests__/portfolio-provider.test.tsx`

---

### Task 2: Build the InsuranceExposureWidget (30% Hero Companion)

**Files:**
- Create: `client/src/components/assets/insurance/InsuranceExposureWidget.tsx`
- Test: `client/src/components/__tests__/InsuranceExposureWidget.test.tsx`

- [ ] **Step 1: Write unit tests for InsuranceExposureWidget**
  Create `client/src/components/__tests__/InsuranceExposureWidget.test.tsx`:
  - Test calculation of insurer counterparty slices and category slices (Life Insurance, Retirement PER, Savings, Term).
  - Test calculation of total coverage amount and annual premium burden.
  - Test interactive selection callback when clicking an insurer slice.
  - Test empty state handling.

- [ ] **Step 2: Implement InsuranceExposureWidget.tsx**
  Implement `InsuranceExposureWidget`:
  - **Props**:
    ```ts
    interface InsuranceExposureWidgetProps {
      totalInsuranceValue: number;
      policies: PortfolioAssetItem[];
      activeFilter: { type: "insurer" | "category"; key: string } | null;
      onSelectFilter: (filter: { type: "insurer" | "category"; key: string } | null) => void;
      formatCurrency: (val: number) => string;
      loading?: boolean;
    }
    ```
  - **Metrics Computation**:
    - `totalCoverage`: Sum of `coverageAmount` across policies.
    - `annualPremiumBurden`: Sum of annualized premiums (`premiumAmount * (frequency === "monthly" ? 12 : frequency === "quarterly" ? 4 : frequency === "semi-annually" ? 2 : 1)`).
    - `insurerSlices`: Group policies by `insurer || "Unknown"`, compute value, count, and percentage.
    - `categorySlices`: Group policies by `policyType || category || "life_insurance"`.
  - **Visual Design**:
    - Mode toggle: "By Insurer" vs "By Category".
    - Progress multi-segment bar with distinct OKLCH palette colors.
    - Interactive slice rows showing insurer/category, count, value, and percent.
    - Key summary footer displaying `Total Coverage (Guaranteed)` and `Annual Premiums (Outflow)`.

- [ ] **Step 3: Verify InsuranceExposureWidget tests pass**
  Run: `npm --prefix client test -- --run src/components/__tests__/InsuranceExposureWidget.test.tsx`

---

### Task 3: Overhaul InsuranceDetail (Zero Fake Data & Clean Private Terminal Layout)

**Files:**
- Modify: `client/src/components/assets/insurance/InsuranceDetail.tsx`
- Test: `client/src/components/__tests__/InsuranceDetail.test.tsx`

- [ ] **Step 1: Write unit tests for InsuranceDetail**
  Create `client/src/components/__tests__/InsuranceDetail.test.tsx`:
  - Assert that no synthetic or hardcoded random data exists.
  - Verify display of authentic policy fields (current value, total contributions/purchase price, coverage amount, premium & frequency, beneficiaries, insurer, policy number).
  - Verify edit and delete dialog interactions.

- [ ] **Step 2: Cleanse and redesign InsuranceDetail.tsx**
  In `client/src/components/assets/insurance/InsuranceDetail.tsx`:
  - Replace hardcoded `Intl.NumberFormat("fr-FR", ...)` with `useCurrency()` hook.
  - Completely remove the fake EChart series (`purchasePrice * 0.95 ... 1.05`).
  - Replace it with:
    - Authentic Capital Accumulation & Coverage Pillars: [Capital Versé / Prix d'achat] vs [Valeur de Rachat Actuelle] vs [Capital Garanti / Décès] with explicit status and percentage progression.
    - Contract Terms card (Policy Number, Insurer, Policy Type / Tax Wrapper, Premium Amount & Frequency, Opening Date & Policy Age, Maturity Date).
    - Beneficiary & Ownership Clauses card (Beneficiaries, Ownership Mode, Personal/Company).
    - Clean Action Bar (Edit Policy, Delete Policy).

- [ ] **Step 3: Run InsuranceDetail unit tests**
  Run: `npm --prefix client test -- --run src/components/__tests__/InsuranceDetail.test.tsx`

---

### Task 4: Rebuild InsuranceList with 70/30 Layout, 2 Tabs, and Adaptive Split/Sheet Details

**Files:**
- Modify: `client/src/components/assets/insurance/InsuranceList.tsx`
- Test: `client/src/components/__tests__/InsuranceList-actions.test.tsx`

- [ ] **Step 1: Write comprehensive integration tests for InsuranceList**
  Create `client/src/components/__tests__/InsuranceList-actions.test.tsx`:
  - Test 1: Renders clean canonical `AssetPageHeader` with inline summary pill and action buttons (no heavy banner cards).
  - Test 2: Renders 70/30 hero section (`AssetHeroChart` + `InsuranceExposureWidget`).
  - Test 3: Triggers in-viewport active cross-filter banner upon clicking a widget slice.
  - Test 4: Seamlessly switches between "Insurance Ledger" and "Holdings détaillées" workspace tabs.
  - Test 5: On desktop in `detailMode="panel"`, selecting a policy activates the split-screen Details Pane (60/40) while keeping the ledger visible.
  - Test 6: On mobile/narrow screens, selecting a policy opens the slide-over `Sheet`.
  - Test 7: Handles policy creation via `AddInsuranceForm` dialog.

- [ ] **Step 2: Implement Private Terminal InsuranceList.tsx**
  In `client/src/components/assets/insurance/InsuranceList.tsx`:
  - **Header**: Canonical `AssetPageHeader` with title, subtitle, concise status pill (`{count} policies • {formatCurrency(totalValue)} • {formatCurrency(totalCoverage)} coverage`), and `+ Add Policy` button.
  - **Hero 70/30**:
    ```tsx
    <div className="grid grid-cols-1 gap-6 border-b border-border/30 pb-6 lg:grid-cols-10">
      <div className="lg:col-span-7 pr-0 lg:pr-6 flex flex-col justify-between">
        <ErrorBoundary>
          <AssetHeroChart
            title="Insurance & Retirement Capital"
            titleTooltip="Historical surrender value and capital accumulation across life insurance and retirement policies"
            data={performanceData}
            holdings={chartHoldings}
            totalEquity={totalValue}
            totalGain={totalGain}
            totalGainPercent={gainPercent}
            formatCurrency={formatCurrency}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            portfolioID={currentPortfolio}
            loading={loading && insuranceAssets.length === 0}
            defaultBenchmark="none"
            layoutId="insuranceHeroRangePillActive"
          />
        </ErrorBoundary>
      </div>
      <div className="lg:col-span-3 border-t lg:border-t-0 lg:border-l border-border/30 pt-6 lg:pt-0 pl-0 lg:pl-6 flex flex-col justify-between">
        <ErrorBoundary>
          <InsuranceExposureWidget
            totalInsuranceValue={totalValue}
            policies={insuranceAssets}
            activeFilter={activeFilter}
            onSelectFilter={setActiveFilter}
            formatCurrency={formatCurrency}
            loading={loading && insuranceAssets.length === 0}
          />
        </ErrorBoundary>
      </div>
    </div>
    ```
  - **Active Cross-Filter Banner**:
    - Animated `motion.div` displaying `Filtered by [Insurer|Category]: [Name] ([count] policies • [value] • [percent]%)` with `Jump to Ledger` and `Clear` buttons.
  - **Toolbar**:
    - Multi-field SearchInput, Category dropdown, multi-criteria sort (Value, Gain, Coverage, Return, Name), and TableDensity toggle (`compact` vs `normal` persisted in localStorage).
  - **Segmented Workspace Navigation (2 Tabs)**:
    - Tab 1: **Insurance Ledger**: Compact table view with density toggle, real policy data columns, quick row actions.
    - Tab 2: **Holdings détaillées**: Grouped view (by Insurer or Policy Type), detailing key contractual parameters (Beneficiaries, Maturity, Coverage ratio, Tax wrapper).
  - **Adaptive Split-Screen / Sheet**:
    - In desktop view when `detailMode="panel"` is active: split workspace (60% list / 40% docked Details Pane) with close button.
    - In mobile/sheet view: Slide-over `Sheet` modal (`SheetContent side="right"`).

- [ ] **Step 3: Run InsuranceList-actions unit tests**
  Run: `npm --prefix client test -- --run src/components/__tests__/InsuranceList-actions.test.tsx`

---

### Task 5: End-to-End Verification, Code Quality & Clean Rebuild

**Files:**
- Verify: `client/src/routes/_app.assets.insurance.lazy.tsx`
- Verify: Full client test suite and type check

- [ ] **Step 1: Run client TypeScript check**
  Run: `npm --prefix client run type-check || npm --prefix client exec tsc --noEmit`

- [ ] **Step 2: Run linter/formatter**
  Run: `npx biome check client/src/components/assets/insurance`

- [ ] **Step 3: Run all asset page regression tests**
  Run: `npm --prefix client test -- --run src/components/__tests__/InsuranceList-actions.test.tsx src/components/__tests__/SavingsList-actions.test.tsx src/components/__tests__/AccountsList-actions.test.tsx`

- [ ] **Step 4: Verify route rendering in lazy file route**
  Confirm `client/src/routes/_app.assets.insurance.lazy.tsx` properly passes `detailMode="panel"` and navigation callbacks to `InsuranceList`.
