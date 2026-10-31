# Maximum Asset Logo Coverage Implementation Plan (Finalized)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

---

## Goal Description

Resolve all missing asset logos across Cryptos and Stocks/Funds to achieve >99% coverage:
1. **Fix Vite Dev Proxy**: Add `/api` proxy to `client/vite.config.ts` so the frontend dev server forwards `/api/v1/logos/*` requests to the Go backend.
2. **Aggressive Derivative/Wrapper Normalization**: Automatically peel off bridge and wrapper labels (e.g., `sol (portal)` &rarr; `SOL`, `aave token (portal)` &rarr; `AAVE`, `kcc-peg usd coin` &rarr; `USDC`, `XDG` &rarr; `DOGE`, `XXLM` &rarr; `XLM`).
3. **Rich Embedded Pack (~500 Cryptos + ~200 Stocks, ~12-15 MB, well within the 50 MB budget)**: Embedded directly into `client/public/logos/crypto/` and `client/public/logos/stocks/` for instant 0ms offline availability.
4. **Multi-Source Backend Resolver & Disk Cache**:
   - Crypto: CoinCap CDN (`https://assets.coincap.io/assets/icons/{symbol}@2x.png`, verified 100% coverage on altcoins), TrustWallet catalog (150k+ contracts), CoinGecko.
   - Stocks & Funds: NVSTly, FinancialModelingPrep (`https://financialmodelingprep.com/image-stock/{symbol}.png`), TradingView SVG CDN (`https://s3-symbol-logo.tradingview.com/{symbol}.svg`), Clearbit, and Google S2 Favicon.
   - Permanent disk caching to `./data/logos/`.
5. **Background Portfolio Pre-warming**: Auto-download and cache logos for all assets in the user's active portfolio on load so there is zero waiting time.

---

## Decisions Reached During `/grill-me`

- **Storage Budget**: Up to 50 MB authorized. We will ship a rich ~12-15 MB embedded pack of ~500 top cryptos and ~200 stocks/ETFs.
- **Wrapped & Bridged Assets**: Aggressive normalization to native asset. `sol (portal)` maps to Solana logo, `aave token (portal)` maps to Aave logo, `kcc-peg usd coin` maps to USDC logo.
- **Client/Server Cooperation**: Embedded files take priority (0ms); any miss hits the Go server proxy, which fetches from CoinCap / TrustWallet / NVSTly / TradingView and writes permanently to `/data/logos/`.

---

## Proposed Changes

### Component 1: Client Dev Proxy & Symbol Normalizer

#### [MODIFY] `client/vite.config.ts`
- Add proxy rule for `/api` targeting `http://localhost:8080`.

#### [MODIFY] `client/src/components/shared/AssetLogo.tsx`
- Implement `cleanAssetSymbol(symbol: string, name?: string): string`:
  - Handle Kraken tickers: `XDG` &rarr; `DOGE`, `XXBT` &rarr; `BTC`, `XETH` &rarr; `ETH`, `XXLM` &rarr; `XLM`, `XXRP` &rarr; `XRP`, `ZUSD` &rarr; `USD`, `ZEUR` &rarr; `EUR`.
  - Handle bridge/portal tags: strip `(portal)`, `portal`, `wormhole`, `kcc-peg`, `bridged`, `wrapped`, `(wormhole)`.
  - Match common names: if symbol is generic or bridge token, extract native symbol from name (e.g. `kcc-peg usd coin` &rarr; `USDC`, `sol (portal)` &rarr; `SOL`).
- Expand bundled index to check embedded logo availability.

---

### Component 2: Backend Logo Service

#### [MODIFY] `server/internal/service/logo/service.go`
- Add CoinCap CDN upstream resolver:
  `https://assets.coincap.io/assets/icons/%s@2x.png`
- Add TradingView & FinancialModelingPrep resolvers for stocks:
  - `https://financialmodelingprep.com/image-stock/%s.png`
  - `https://s3-symbol-logo.tradingview.com/%s.svg`
- Strip exchange suffixes when querying ticker repositories (e.g. `MC.PA` &rarr; try `MC.PA`, then fallback to `MC`).
- Add Kraken ticker aliases (`XDG` &rarr; `DOGE`, `XXLM` &rarr; `XLM`, `XXBT` &rarr; `BTC`).

---

### Component 3: Embedded Rich Logo Pack & Fetcher Script

#### [NEW] Scripts / Bundled Assets
- Download and place top ~500 crypto icons (from CoinCap / TrustWallet clean SVGs/PNGs) into `client/public/logos/crypto/`.
- Download and place top ~200 stock/ETF icons (NVSTly / FinancialModelingPrep / TradingView) into `client/public/logos/stocks/`.
- Keep total size around ~12-15 MB (well under the 50 MB limit).

---

## Verification Plan

### Automated Tests
1. **Backend Tests**:
   - `server/internal/service/logo/service_test.go`:
     - Test CoinCap resolver for `FLR`, `SUI`, `AAVE`, `FIL`.
     - Test ticker alias mapping (`XDG` &rarr; `DOGE`, `XXLM` &rarr; `XLM`).
     - Test stock ticker resolver with and without exchange suffixes.
   - Run: `cd server && go test -v ./internal/service/logo/...`
2. **Frontend Tests**:
   - `client/src/components/shared/__tests__/AssetLogo.test.tsx`:
     - Test wrapped/portal token normalization (`sol (portal)` &rarr; `SOL`, `kcc-peg usd coin` &rarr; `USDC`, `aave token (portal)` &rarr; `AAVE`).
     - Test Kraken aliases (`XDG` &rarr; `DOGE`, `XXLM` &rarr; `XLM`).
     - Test rendering of embedded and server-cached logos.
   - Run: `cd client && npx vitest run src/components/shared/__tests__/AssetLogo.test.tsx`
3. **Typecheck & Build**:
   - Run: `cd client && pnpm typecheck && pnpm build`

### Manual Verification
1. Refresh `/assets/crypto`:
   - Verify every single item in the Kraken list from the screenshot (`BTC`, `SOL`, `ETH`, `DOGE`, `SUI`, `AAVE`, `FLR`, `USDC`, `XLM`, `XRP`, `FIL`) displays a clear authentic brand logo.
2. Check network requests in browser devtools:
   - Verify requests to `/api/v1/logos/*` return HTTP 200 via the Vite proxy.
3. Check `./data/logos/`:
   - Verify logos are permanently persisted locally.
