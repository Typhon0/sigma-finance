# Blockchain Provider Qualification Matrix (Alchemy-First Architecture)

**Date:** 2026-10-28 22:27:59 UTC  
**Test Configuration:** Single ALCHEMY_API_KEY for 7 networks (EVM, Solana, Bitcoin)  
**Operating Target:** €0/month operating cost (30,000,000 Compute Units pool)  

### 1. Multichain Portfolio API
- **Status:** ✅ Succeeded in 502.084811ms
- **Tokens Ingested:** 100
- **Partial Errors:** None

### 2. EVM Historical Transfers By Wallet API

| Network | Subdomain | Internal Category Support | Status | Latency | Transfers Ingested | Has PageKey? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Ethereum | eth-mainnet | Supported | ✅ Succeeded | 195.814897ms | 25 | true |
| Base | base-mainnet | Supported | ✅ Succeeded | 468.681245ms | 25 | true |
| Arbitrum One | arb-mainnet | Excluded (API Limitation) | ✅ Succeeded | 492.549149ms | 25 | true |
| Optimism | opt-mainnet | Excluded (API Limitation) | ✅ Succeeded | 480.554668ms | 25 | true |
| Polygon PoS | polygon-mainnet | Supported | ✅ Succeeded | 292.406392ms | 25 | true |

### 3. Solana API (Balance & History)
- **Status:** ✅ Succeeded in 108.133036ms
- **Balance:** 11175975.4428 SOL (11175975442787702 lamports)
- **Signatures Ingested:** 10

### 4. Bitcoin UTXO REST API
- **UTXO Endpoint:** HTTP 401: {"error": "UTXO requests are not allowed."}
- **Note:** Ensure 'Bitcoin' is added and UTXO is enabled in your Alchemy App dashboard.
