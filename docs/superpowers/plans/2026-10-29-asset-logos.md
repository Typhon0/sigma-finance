# [Feature Name] Implementation Plan: High-Coverage Locally-Cached Asset Logos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide maximum coverage of authentic logos for cryptocurrencies and stocks/ETFs, served via a self-hosted server-side proxy with persistent local disk caching (`/data/logos`) for zero external downtime dependency and instant local loading.

**Architecture:** A multi-tier asset logo pipeline. The client renders `<AssetLogo>` with a deterministic monogram fallback. The Go backend exposes `GET /api/v1/logos/:assetType/:identifier` which checks the persistent disk cache (`/data/logos`), bundled assets, and multi-source upstream resolvers (TrustWallet 150k local catalog, Clearbit, Google S2 Favicon, open-source financial icons), sanitizing and caching every fetched logo permanently to disk.

**Tech Stack:** Go (Fiber v2), React 19, TypeScript, Docker volume persistence.

---

## Tasks

### Task 1: Server Logo Cache & Multi-Source Service
- [ ] Create `server/internal/service/logo/service.go` defining the `LogoService` interface and disk storage caching under `LOGOS_CACHE_DIR` (default `/data/logos` or `./data/logos`).
- [ ] Implement Crypto logo resolver checking the local bundled `trustwallet.Client` catalog (150k+ tokens with `imageUrl`), falling back to TrustWallet GitHub raw and CoinGecko.
- [ ] Implement Stock/Fund logo resolver:
  - Checks `instruments` table for website domain.
  - Tries Clearbit (`https://logo.clearbit.com/{domain}`).
  - Falls back to Google S2 Favicon 128px (`https://www.google.com/s2/favicons?domain={domain}&sz=128`).
  - Falls back to `invvest/financial-icons` repository for stock symbols (`AAPL`, `MSFT`, `SPY`, etc.).
- [ ] Implement image validation & sanitization (validate MIME type, enforce max 2MB size, prevent SSRF).
- [ ] Add unit tests in `server/internal/service/logo/service_test.go`.

### Task 2: Fiber Logo Route & Docker Volume Setup
- [ ] In `server/cmd/app.go`, register `app.Get("/api/v1/logos/:assetType/:identifier", logoHandler)`.
- [ ] Set response headers: `Cache-Control: public, max-age=31536000, immutable`, `Content-Type`, and `ETag`.
- [ ] In `docker-compose.yml`, mount `./data/logos:/data/logos` for `sigma-server`.

### Task 3: Client `<AssetLogo>` Reusable Component
- [ ] Create `client/src/components/shared/AssetLogo.tsx` with size variants (`xs`, `sm`, `md`, `lg`) and `onError` fallback to `<AssetMonogram>`.
- [ ] Implement `<AssetMonogram>` with deterministic hash-based terminal color accents matching `DESIGN.md`.
- [ ] Write unit tests in `client/src/components/shared/__tests__/AssetLogo.test.tsx`.

### Task 4: Integrate into Tables & Detail Views
- [ ] In `client/src/components/assets/stocks-funds/StocksFundsPositions.tsx`, provide `renderInstrumentIcon` using `<AssetLogo>` to display stock/ETF logos in the table.
- [ ] In `client/src/components/assets/crypto/CryptoList.tsx`, update `renderCryptoIcon` to use `<AssetLogo>` for token logos.
- [ ] In `client/src/components/assets/stocks-funds/StockDetail.tsx` and `CryptoList.tsx` slideover sheet, display the logo in the header.

### Task 5: Verification & End-to-End Tests
- [ ] Run backend Go tests: `cd server && go test ./internal/service/logo/...`
- [ ] Run client Vitest suites: `cd client && pnpm test:run`
- [ ] Verify production build: `cd client && pnpm build`

