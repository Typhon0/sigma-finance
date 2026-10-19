# Historical Datasets Status

This document tracks the implementation and availability status of historical datasets and market data packs in SigmaFinance.

## 🟩 DONE

### 1. Crypto Daily Packs (Binance)
*   **Asset Type**: `CRYPTO`
*   **Status**: Fully supported and publicly redistributable.
*   **Specification**: `packs/specs/crypto-binance-core-250-daily-usdt.yaml` (up to 250 assets in top-cap spot universe).
*   **History**: Starts 2017-01-01.

### 2. FX Daily Rates Pack
*   **Asset Type**: `FX` (Forex)
*   **Status**: Fully supported and publicly redistributable.
*   **Specification**: `packs/specs/fx-ecb-core-daily.yaml` (European Central Bank reference rates).
*   **History**: Starts 2017-01-01.

### 3. US Stock Open Dataset Strategy
*   **Asset Type**: `STOCK` / `ETF`
*   **Status**: Design/pipeline strategy implemented via local-only builds utilizing `MARKETPARQUET` parquet format or fallback APIs.

### 4. US & Europe Starter Daily Pack
*   **Asset Type**: `STOCK` / `ETF`
*   **Status**: Fully implemented. Combines key U.S. giants, core ETFs, and Euronext Paris equities into a single optimized plug-and-play local build pack.
*   **Specification**: `packs/specs/us-europe-starter-daily.yaml`
*   **Universe**: `packs/universes/us-europe-starter.yaml`
*   **History**: Starts 2017-01-01.

### 5. Daily-only Historical Architecture
*   **Status**: Complete. `.sfpack` files store daily OHLVC bars, mapped to Postgres metadata and overlays.

### 6. Pack Distribution System
*   **Status**: Complete. Fully supports signature verification, aggregate registries (`registry.json`), CLI `install`/`validate` commands, and GitHub Actions release pipelines.


---

## 🟨 IN PROGRESS

### 1. US Stock Historical Snapshot Pack
*   **Asset Type**: `STOCK` / `ETF`
*   **Status**: The generator pipeline supports building local stock/ETF packs. Integration with Stooq's U.S. Daily ASCII dataset is planned to compile local-build snapshot packs.

### 2. Regional Equity & Global ETF Packs (Stooq Bulk Ingestion Strategy)
*   **Asset Type**: `STOCK` / `ETF` / `FX` / `INDEX`
*   **Status**: Active strategy defined to ingest all Stooq Daily ASCII archives to generate regional historical packs for:
    *   **U.S. daily equities** (`d_us_txt.zip`)
    *   **World daily equities/indices/ETFs** (`d_world_txt.zip` - covers Global/European/Emerging assets)
    *   **U.K. daily equities** (`d_uk_txt.zip`)
    *   **Japan daily equities** (`d_jp_txt.zip`)
    *   **Hong Kong daily equities** (`d_hk_txt.zip`)
    *   **Poland daily equities** (`d_pl_txt.zip`)
    *   **Hungary daily equities** (`d_hu_txt.zip`)
    *   **Macroeconomic daily data** (`d_macro_txt.zip`)

---

## 🟥 MISSING DATASETS

The following datasets currently have no active ingestion paths planned or in progress:
*   **Funds / NAV history** (mutual funds outside of standard ETFs)

---

## 🟦 POSSIBLE SOURCES TO EXPLORE

The following sources can be investigated for acquiring or compiling historical open/public datasets:
*   **Hugging Face Datasets** (for community-shared financial parquet data)
*   **Kaggle Datasets** (for historical stock/ETF/crypto dumps)
*   **Stooq** (Primary Source - Daily ASCII archives for all active equities and indices)
*   **ECB FX Rates** (already leveraged; expand to other central bank archives)
*   **GitHub historical datasets** (public repos hosting CSV/parquet tick or daily history)
*   **Public exchange datasets** (direct downloads provided by stock and derivative exchanges)

---

## 🛠️ Ingestion & Local Pack Generation Pipeline

To process the downloaded Stooq archives into signed historical packs (`.sfpack`):

1.  **Storage Placement**: Place the downloaded ZIP files under `data/market-data/source-cache/stooq/`.
2.  **Unpack & Partition**: Run an extraction script to read each ticker's `.txt` CSV from the ZIP, clean the format (map Stooq's headers to canonical OHLVC headers, append regional market suffixes if missing), and write them as date-partitioned Parquet files under `data/market-data/local-builds/`.
3.  **Pack Build**: Run the package generator to read the Parquet partitions and write optimized daily packs:
    ```bash
    go run ./cmd/bun market-data packs build --spec <spec_file>.yaml --out ./dist --archive --sign
    ```


