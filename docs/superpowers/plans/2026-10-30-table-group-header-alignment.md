# Positions Data Table: Group Header Column Alignment & Wallet P&L (Finalized Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

---

## Goal Description

In `PositionsDataTable.tsx` (the shared holdings table across Crypto and Stocks/Funds), the group header rows (`GenericGroupHeaderRow`) currently suffer from:
1. **Column Misalignment**: Group totals (`Value` and `Total P&L`) are shifted into the `Total P&L` and `Weight` columns because the flex container lacks column boundaries for `Weight` (`w-[80px]`) and `Actions` (`w-[36px]/[44px]`).
2. **Missing Wallet P&L (`—`)**: Wallets with mixed cost bases (e.g. Kraken Spot with 11 of 13 holdings priced, Cypherock with unrecorded tokens) show `—` because of an all-or-nothing check (`groupItems.every(p => p.pl !== null)`).

This finalized plan implements pixel-perfect column alignment, two-line group P&L (amount + weighted percentage), partial P&L calculation with an asterisk indicator (`*`) and tooltip, and wallet portfolio weighting in the `Weight` column.

---

## Decisions Reached During `/grill-me`

1. **Partial P&L Display**:
   - When all holdings have cost basis: display full P&L (e.g. `-$52.78` / `-6.82%`).
   - When some holdings lack cost basis: sum all known positions and display with an asterisk (`+$1,240.50*` / `+14.2%*`) and a tooltip: `"Partial P&L based on X of Y assets with recorded cost basis"`.
   - When 0 holdings have cost basis: display `—`.
2. **Two-Line Group P&L**:
   - Top line: dollar amount (e.g. `+$1,240.50*`), font-mono font-semibold text-gain/loss.
   - Bottom line: weighted percentage (e.g. `+14.2%*`), text-micro text-gain-muted/loss-muted.
3. **Wallet Portfolio Weight**:
   - Group headers will display the wallet's total share of the active portfolio (e.g. `63.1%` with mini-bar) in the `Weight` column, matching the position rows.
4. **Column Alignment**:
   - `Value`: `w-[105px] px-2 text-right shrink-0`
   - `Total P&L`: `w-[115px] px-2 text-right shrink-0`
   - `Weight`: `w-[80px] px-2 text-right shrink-0 hidden md:block`
   - `Actions`: `w-[36px] pr-2.5 pl-1 shrink-0` (compact) or `w-[44px] pr-3 shrink-0` (normal)
   - Left container padding: `pl-2.5 sm:pl-3` (matching the status bar).

---

## Proposed Changes

### Component: Holdings Table (`client/src/components/assets/positions-table/`)

#### [MODIFY] `client/src/components/assets/positions-table/types.ts`
- Extend `TableRowModel` for `kind: "group"`:
  ```typescript
  plPercent?: number | null;
  weight?: number;
  isPartialPl?: boolean;
  knownCostBasisCount?: number;
  ```

#### [MODIFY] `client/src/components/assets/positions-table/PositionsDataTable.tsx`
1. **Group Aggregation in `tableRows`**:
   - Calculate `knownPlItems = groupItems.filter(p => p.pl !== null)`.
   - Calculate `totalCost = knownPlItems.reduce((sum, p) => sum + (p.cost > 0 ? p.cost : 0), 0)`.
   - Calculate `totalPl = knownPlItems.length > 0 ? knownPlItems.reduce((sum, p) => sum + (p.pl ?? 0), 0) : null`.
   - Calculate `plPercent = totalPl !== null && totalCost > 0 ? (totalPl / totalCost) * 100 : null`.
   - Calculate `groupWeight = groupItems.reduce((sum, p) => sum + (p.weight ?? 0), 0)`.
   - Set `isPartialPl = knownPlItems.length > 0 && knownPlItems.length < groupItems.length`.

2. **Column Structure in `GenericGroupHeaderRow`**:
   - Render `Value` (`w-[105px] px-2 text-right`).
   - Render `Total P&L` (`w-[115px] px-2 text-right`) with 2-line layout (dollar + percent + `*` if partial).
   - Render `Weight` (`w-[80px] px-2 text-right hidden md:block`) with percentage and animated mini-progress bar.
   - Render `Actions` spacer (`w-[36px]` or `w-[44px]`).

#### [MODIFY] `client/src/components/assets/positions-table/PositionsTableSkeleton.tsx`
- Reorder columns to strictly match `PositionsDataTable`:
  `Instrument` &rarr; `Price` &rarr; `Change (1D)` &rarr; `Trend (7D)` &rarr; `Quantity` &rarr; `Avg Cost & Basis` &rarr; `Value` &rarr; `Total P&L` &rarr; `Weight` &rarr; `Actions`.

---

## Verification Plan

### Automated Tests
1. **Unit Tests** (`client/src/components/assets/positions-table/__tests__/positions-data-table.test.tsx`):
   - Test group header renders `Value`, `Total P&L` (amount + percentage), and `Weight` with proper column widths.
   - Test wallet with 100% cost basis: renders exact dollar and percentage without asterisk.
   - Test wallet with partial cost basis (e.g. 1 of 2 assets): renders partial P&L with `*` and explanatory tooltip.
   - Test wallet with 0 cost basis: renders `—`.
   - Test group weight displays correctly with percentage and mini-bar.
   - Command: `cd client && npx vitest run src/components/assets/positions-table/__tests__/positions-data-table.test.tsx`

2. **Regression & Typecheck**:
   - Command: `cd client && npx vitest run src/components/__tests__/stocks-funds-positions-virtualization.test.tsx src/components/__tests__/crypto-list-table.test.tsx`
   - Command: `cd client && pnpm typecheck && pnpm build`

### Manual Verification
1. Inspect `/assets/crypto`:
   - Verify `Kraken Spot` header has `$9,997.35` positioned directly under **Value ▼**.
   - Verify its P&L is positioned directly under **Total P&L** with dollar amount on top, percentage below, and `*` tooltip.
   - Verify its weight is positioned directly under **Weight** with percentage and mini-gauge.
   - Verify `Solana Wallet` displays `$917.76` under **Value ▼**, `-$52.78` (`-6.82%`) under **Total P&L**, and its portfolio weight under **Weight**.
