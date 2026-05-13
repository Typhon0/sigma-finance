.RECIPEPREFIX := >
SHELL := /bin/bash
.ONESHELL:

ROOT_DIR := $(CURDIR)
SERVER_DIR := $(ROOT_DIR)/server
DIST_DIR := $(ROOT_DIR)/dist/market-data-fixture
PACK_KEY := $(ROOT_DIR)/packs/fixtures/keys/test-ed25519-private-key.hex
FIXTURE_ADDR ?= 127.0.0.1:18080
FIXTURE_BASE_URL := http://$(FIXTURE_ADDR)
GO_CACHE ?= /tmp/go-build-cache

CRYPTO_SPEC := ../packs/specs/ci/crypto-binance-core-daily-usdt.yaml
FX_SPEC := ../packs/specs/ci/fx-ecb-core-daily.yaml
CRYPTO_PACK_ID := crypto-binance-core-daily-usdt
FX_PACK_ID := fx-ecb-core-daily
CRYPTO_VERSION := 2026.05.01
FX_VERSION := 2026.05.11
CRYPTO_ARCHIVE := $(DIST_DIR)/$(CRYPTO_PACK_ID)-$(CRYPTO_VERSION).sfpack
FX_ARCHIVE := $(DIST_DIR)/$(FX_PACK_ID)-$(FX_VERSION).sfpack

.PHONY: market-data-pack-fixture
market-data-pack-fixture:
>set -euo pipefail
>mkdir -p "$(DIST_DIR)"
>cd "$(SERVER_DIR)"
>GOCACHE="$(GO_CACHE)" go run ./cmd/market-data-pack-ci serve-fixtures --addr "$(FIXTURE_ADDR)" > "$(DIST_DIR)/fixture-server.log" 2>&1 &
>fixture_pid=$$!
>trap 'kill $$fixture_pid >/dev/null 2>&1 || true' EXIT
>for _ in {1..20}; do
>  if curl --fail --silent "$(FIXTURE_BASE_URL)/healthz" >/dev/null 2>&1; then
>    break
>  fi
>  sleep 1
>done
>curl --fail --silent "$(FIXTURE_BASE_URL)/healthz" >/dev/null
>GOCACHE="$(GO_CACHE)" go run ./cmd/bun market-data packs build \
>  --spec "$(CRYPTO_SPEC)" \
>  --out ../dist/market-data-fixture \
>  --build-mode ci_fixture \
>  --all \
>  --archive \
>  --sign \
>  --signing-key "$(PACK_KEY)" \
>  --source-base-url "$(FIXTURE_BASE_URL)" \
>  --download-url "file://$(CRYPTO_ARCHIVE)" \
>  --signature-url "file://$(CRYPTO_ARCHIVE).sig"
>GOCACHE="$(GO_CACHE)" go run ./cmd/bun market-data packs build \
>  --spec "$(FX_SPEC)" \
>  --out ../dist/market-data-fixture \
>  --build-mode ci_fixture \
>  --all \
>  --archive \
>  --sign \
>  --signing-key "$(PACK_KEY)" \
>  --source-base-url "$(FIXTURE_BASE_URL)" \
>  --download-url "file://$(FX_ARCHIVE)" \
>  --signature-url "file://$(FX_ARCHIVE).sig"
>GOCACHE="$(GO_CACHE)" go run ./cmd/market-data-pack-ci aggregate-registry \
>  --input ../dist/market-data-fixture \
>  --out ../dist/market-data-fixture/registry.json \
>  --latest-version fixture
>GOCACHE="$(GO_CACHE)" go run ./cmd/market-data-pack-ci validate-registry \
>  --registry ../dist/market-data-fixture/registry.json \
>  --dist-dir ../dist/market-data-fixture \
>  --expected-pack-ids "$(CRYPTO_PACK_ID),$(FX_PACK_ID)"

.PHONY: market-data-pack-crypto-small
market-data-pack-crypto-small:
>set -euo pipefail
>mkdir -p "$(DIST_DIR)"
>cd "$(SERVER_DIR)"
>GOCACHE="$(GO_CACHE)" go run ./cmd/market-data-pack-ci serve-fixtures --addr "$(FIXTURE_ADDR)" > "$(DIST_DIR)/fixture-server.log" 2>&1 &
>fixture_pid=$$!
>trap 'kill $$fixture_pid >/dev/null 2>&1 || true' EXIT
>for _ in {1..20}; do
>  if curl --fail --silent "$(FIXTURE_BASE_URL)/healthz" >/dev/null 2>&1; then
>    break
>  fi
>  sleep 1
>done
>curl --fail --silent "$(FIXTURE_BASE_URL)/healthz" >/dev/null
>GOCACHE="$(GO_CACHE)" go run ./cmd/bun market-data packs build \
>  --spec "$(CRYPTO_SPEC)" \
>  --out ../dist/market-data-fixture \
>  --build-mode ci_fixture \
>  --all \
>  --archive \
>  --sign \
>  --signing-key "$(PACK_KEY)" \
>  --source-base-url "$(FIXTURE_BASE_URL)" \
>  --download-url "file://$(CRYPTO_ARCHIVE)" \
>  --signature-url "file://$(CRYPTO_ARCHIVE).sig"

.PHONY: market-data-pack-validate
market-data-pack-validate:
>set -euo pipefail
>cd "$(SERVER_DIR)"
>for pack_dir in ../dist/market-data-fixture/packs/*; do
>  GOCACHE="$(GO_CACHE)" go run ./cmd/bun market-data packs validate --path "$$pack_dir"
>done
>for pack_file in ../dist/market-data-fixture/*.sfpack; do
>  GOCACHE="$(GO_CACHE)" go run ./cmd/bun market-data packs validate --path "$$pack_file"
>done

.PHONY: market-data-registry-fixture
market-data-registry-fixture:
>set -euo pipefail
>cd "$(SERVER_DIR)"
>GOCACHE="$(GO_CACHE)" go run ./cmd/market-data-pack-ci aggregate-registry \
>  --input ../dist/market-data-fixture \
>  --out ../dist/market-data-fixture/registry.json \
>  --latest-version fixture
>GOCACHE="$(GO_CACHE)" go run ./cmd/market-data-pack-ci validate-registry \
>  --registry ../dist/market-data-fixture/registry.json \
>  --dist-dir ../dist/market-data-fixture \
>  --expected-pack-ids "$(CRYPTO_PACK_ID),$(FX_PACK_ID)"

.PHONY: market-data-pack-smoke
market-data-pack-smoke: market-data-pack-fixture market-data-pack-validate market-data-registry-fixture
>set -euo pipefail
>cd "$(SERVER_DIR)"
>if [ "$${MARKET_DATA_SMOKE_INSTALL:-false}" = "true" ] && [ -n "$${DATABASE_URL:-$${DB_HOST:-}}" ]; then
>  MARKET_DATA_PACK_REGISTRY_URL="file://$(DIST_DIR)/registry.json" GOCACHE="$(GO_CACHE)" go run ./cmd/bun market-data packs install "$(CRYPTO_PACK_ID)"
>  MARKET_DATA_PACK_REGISTRY_URL="file://$(DIST_DIR)/registry.json" GOCACHE="$(GO_CACHE)" go run ./cmd/bun market-data packs install "$(FX_PACK_ID)"
>  MARKET_DATA_PACK_REGISTRY_URL="file://$(DIST_DIR)/registry.json" GOCACHE="$(GO_CACHE)" go run ./cmd/bun market-data packs status
>else
>  echo "skip install smoke (set MARKET_DATA_SMOKE_INSTALL=true and DB env to enable)"
>fi
