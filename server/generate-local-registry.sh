#!/bin/bash
set -euo pipefail

DIST_DIR="/home/dev/repos/sigma-finance/dist"
SERVER_DIR="/home/dev/repos/sigma-finance/server"

echo "Generating registry entries for stooq packs in ${DIST_DIR}..."

# Remove stale registry files in dist first
rm -f "${DIST_DIR}"/*.registry.json

for sfpack in "${DIST_DIR}"/*.sfpack; do
  [ -e "$sfpack" ] || continue
  filename=$(basename "$sfpack")
  pack_name="${filename%.sfpack}"
  echo "Processing ${filename}..."
  
  go run ./cmd/bun market-data packs registry-entry \
    --pack "$sfpack" \
    --download-url "file://${sfpack}" \
    --out "${DIST_DIR}/${pack_name}.registry.json"
done

echo "Aggregating all registry entries into registry.json..."
go run ./cmd/market-data-pack-ci aggregate-registry \
  --input "${DIST_DIR}" \
  --out "${DIST_DIR}/registry.json" \
  --latest-version "local-build"

echo "Registry generation complete: ${DIST_DIR}/registry.json"
