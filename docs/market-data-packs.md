# Market Data Packs

SigmaFinance uses read-only daily candle packs (`.sfpack`) for long-history charts.
Postgres stores pack metadata, coverage, jobs, and overlay candles; it does not store full historical pack rows.

## Smoke Commands

From repo root:

```bash
make market-data-pack-fixture
make market-data-pack-crypto-small
make market-data-pack-validate
make market-data-registry-fixture
make market-data-pack-smoke
```

What they do:

- `market-data-pack-fixture`: fixture-mode crypto + FX build, archive, sign, registry aggregate, registry validate.
- `market-data-pack-crypto-small`: fixture-mode crypto-only build.
- `market-data-pack-validate`: validates unpacked and archived packs in `dist/market-data-fixture`.
- `market-data-registry-fixture`: rebuilds and validates `dist/market-data-fixture/registry.json`.
- `market-data-pack-smoke`: full fixture flow plus optional install smoke.

Install smoke is skipped by default. To enable:

```bash
MARKET_DATA_SMOKE_INSTALL=true DB_HOST=localhost make market-data-pack-smoke
```

or with `DATABASE_URL` set instead of `DB_HOST`.

## Official Public Pack Creation

The official public build candidates are:

- Crypto: Binance Public Data daily spot (`crypto-binance-core-daily-usdt`)
- FX: ECB daily reference rates (`fx-ecb-core-daily`)

Build locally with explicit commands:

```bash
cd server
GOCACHE=/tmp/go-build-cache go run ./cmd/bun market-data packs build \
  --spec ../packs/specs/crypto-binance-core-daily-usdt.yaml \
  --out ../dist \
  --build-mode public_release \
  --all \
  --archive \
  --sign \
  --signing-key "$PACK_SIGNING_KEY" \
  --download-url "https://example.invalid/crypto-binance-core-daily-usdt-2026.05.01.sfpack" \
  --signature-url "https://example.invalid/crypto-binance-core-daily-usdt-2026.05.01.sfpack.sig"

GOCACHE=/tmp/go-build-cache go run ./cmd/bun market-data packs build \
  --spec ../packs/specs/fx-ecb-core-daily.yaml \
  --out ../dist \
  --build-mode public_release \
  --all \
  --archive \
  --sign \
  --signing-key "$PACK_SIGNING_KEY" \
  --download-url "https://example.invalid/fx-ecb-core-daily-2026.05.11.sfpack" \
  --signature-url "https://example.invalid/fx-ecb-core-daily-2026.05.11.sfpack.sig"
```

Validate output:

```bash
GOCACHE=/tmp/go-build-cache go run ./cmd/bun market-data packs validate --path ../dist/packs/crypto-binance-core-daily-usdt
GOCACHE=/tmp/go-build-cache go run ./cmd/bun market-data packs validate --path ../dist/packs/fx-ecb-core-daily
GOCACHE=/tmp/go-build-cache go run ./cmd/bun market-data packs validate --path ../dist/crypto-binance-core-daily-usdt-2026.05.01.sfpack
GOCACHE=/tmp/go-build-cache go run ./cmd/bun market-data packs validate --path ../dist/fx-ecb-core-daily-2026.05.11.sfpack
```

Generate and validate aggregate registry:

```bash
GOCACHE=/tmp/go-build-cache go run ./cmd/market-data-pack-ci aggregate-registry \
  --input ../dist \
  --out ../dist/registry.json \
  --latest-version local-build

GOCACHE=/tmp/go-build-cache go run ./cmd/market-data-pack-ci validate-registry \
  --registry ../dist/registry.json \
  --dist-dir ../dist \
  --expected-pack-ids "crypto-binance-core-daily-usdt,fx-ecb-core-daily"
```

## Local Pack Creation Flow

Local stock/fund pack builds are local-only and non-redistributable.
No SigmaFinance/system provider key is used for local builds.

Backend/API flow:

1. `startLocalPackBuild(input)` creates local build job + items.
2. Worker resolves local build source:
   - MarketParquet (recommended) date-partitioned parquet files (`stock_daily`, `etf_daily`)
   - fallback per-symbol providers (`TIINGO`, `TWELVEDATA`, `ALPHAVANTAGE`, `FINNHUB`)
3. Worker reads user credential (`market_data_credential`) for API modes, or local folder path for MarketParquet local import mode.
4. Worker writes unpacked local pack under `MARKET_DATA_PACK_STORAGE_PATH/local-builds/<job_id>/packs/<pack_id>/`.
5. Worker registers pack metadata and coverage in existing pack tables.
6. UI polls `packBuildJob(id)` and can cancel with `cancelPackBuildJob(id)`.

Local build statuses: `queued`, `running`, `succeeded`, `partial`, `failed`, `canceled`.

REST endpoints (session auth, own-job scope only):

- `GET /market-data/packs/build-jobs`
- `POST /market-data/packs/build-jobs`
- `GET /market-data/packs/build-jobs/{jobId}`
- `GET /market-data/packs/build-jobs/{jobId}/items`
- `POST /market-data/packs/build-jobs/{jobId}/cancel`
- `POST /market-data/packs/build-jobs/{jobId}/retry-failed`

Local provider order:

1. `MARKETPARQUET` (recommended)
2. `TIINGO` (fallback)
3. `TWELVEDATA` (fallback)
4. `ALPHAVANTAGE` (fallback)
5. `FINNHUB` (fallback)

MarketParquet modes:

- `api_key`: fetches date files from API endpoints and caches under `source-cache/marketparquet`.
- `local_folder`: reads server-local parquet files (for example `by_date/stock_daily/YYYY-MM-DD.parquet` and `by_date/etf_daily/YYYY-MM-DD.parquet`).

Fallback per-symbol local providers:

- `TIINGO`
- `TWELVEDATA`
- `ALPHAVANTAGE`
- `FINNHUB`

`YFINANCE` local key build path is rejected.

## License Gate Behavior

Pack distribution modes:

- `public`: strict gate, no warning-only bypass.
- `private`/`local`: can continue with warning metadata when policy allows local/private use.

Rules:

- Public build requires known license policy and `redistribution_allowed=true`.
- Public build is blocked when `commercial_use_allowed=false`.
- Public unsigned archive is blocked unless explicitly bypassed with `--allow-unsigned-public` (never use in CI/release).
- Stock/fund providers stay local-only unless written redistribution license exists.
- No explicit redistribution license means no public pack.
- No proprietary stock/fund API pack may be published without written redistribution license.

## Supported Sources

- Public crypto candidate: Binance Public Data (`binance-public-data`)
- Public FX candidate: ECB statistics (`ecb-statistics`)
- Stock/fund local builds: MarketParquet recommended (`marketparquet-local-only`), or fallback proprietary API providers (`proprietary-market-data-local-only`)

No public stock pack is shipped by default.
No MarketParquet stock/ETF pack is published in GitHub Releases.

## Signing Keys

Signing key inputs accepted by CLI:

- path to key file
- raw hex/base64 Ed25519 seed/private key
- PEM PKCS8 Ed25519 private key

Fixture smoke uses committed test-only key:

- `packs/fixtures/keys/test-ed25519-private-key.hex`
- `packs/fixtures/keys/test-ed25519-public-key.hex`

Do not use fixture keys for release signing.

## Registry Generation and Install

Per-pack registry entry:

```bash
cd server
GOCACHE=/tmp/go-build-cache go run ./cmd/bun market-data packs registry-entry \
  --pack ../dist/crypto-binance-core-daily-usdt-2026.05.01.sfpack \
  --download-url "https://example.invalid/crypto-binance-core-daily-usdt-2026.05.01.sfpack" \
  --signature-url "https://example.invalid/crypto-binance-core-daily-usdt-2026.05.01.sfpack.sig" \
  --out ../dist/crypto-binance-core-daily-usdt-2026.05.01.registry.json
```

Aggregate registry:

```bash
GOCACHE=/tmp/go-build-cache go run ./cmd/market-data-pack-ci aggregate-registry \
  --input ../dist \
  --out ../dist/registry.json \
  --latest-version local-build
```

Install from local file registry:

```bash
MARKET_DATA_PACK_REGISTRY_URL=file:///absolute/path/to/dist/registry.json \
  GOCACHE=/tmp/go-build-cache \
  go run ./cmd/bun market-data packs install crypto-binance-core-daily-usdt
```

## GitHub Action

Workflow: `.github/workflows/build-market-data-packs.yml`

Modes:

- `mode=fixture`: local fixture server, fast validation.
- `mode=full`: real provider download paths.
- `publish=true`: upload release assets.

Required secret:

- `PACK_SIGNING_KEY`

Required for publish:

- `MARKET_DATA_PACK_BASE_URL` (repo variable)

Safety gates in CI fail when:

- public pack lacks redistributable license metadata
- public pack is unsigned
- forbidden provider (`yahoo-finance`, `proprietary-market-data-local-only`, `marketparquet`) appears in public registry
- checksum/signature/URLs are missing
- registry pack set differs from expected official pack IDs

## Docker and Storage

Recommended persistent mount:

```yaml
volumes:
  - ./data/market-data:/data/market-data
```

Without persistent storage, installed packs are lost after container recreation.

Local stock/fund build output path:

- `MARKET_DATA_PACK_STORAGE_PATH/local-builds`

MarketParquet download cache path:

- `MARKET_DATA_PACK_STORAGE_PATH/source-cache/marketparquet`

## Troubleshooting

- `registry returned HTTP 404`: verify `MARKET_DATA_PACK_REGISTRY_URL` and output path for `registry.json`.
- `relation sigma_finance.market_data_packs does not exist`: run DB migrations before install/list commands.
- signature validation failure: verify signing/public key pair and digest metadata.
- missing provider key: configure enabled credential for selected provider in settings.
- provider rate-limited: lower local build req/min, req/day, or concurrency and retry failed symbols.
- missing symbol mapping: verify `instrument_provider_mappings` for the provider or use canonical provider symbol.
- partial pack status: some symbols failed; run retry-failed after credential/rate-limit/mapping fix.
- adjusted price semantics: MarketParquet candles are split/dividend-adjusted and intended for historical performance charting.
- coverage missing for old transaction: confirm instrument ID + quote currency exists in pack coverage.
- smoke install skipped: set `MARKET_DATA_SMOKE_INSTALL=true` and provide DB env (`DB_HOST` or `DATABASE_URL`).
