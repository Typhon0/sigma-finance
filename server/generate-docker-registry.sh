#!/bin/bash
set -euo pipefail

DIST_DIR="/home/dev/repos/sigma-finance/data/market-data/dist"
SERVER_DIR="/home/dev/repos/sigma-finance/server"

echo "Generating registry entries for stooq packs in ${DIST_DIR}..."

# Remove stale registry files in dist first
rm -f "${DIST_DIR}"/*.registry.json

for sfpack in "${DIST_DIR}"/*.sfpack; do
  [ -e "$sfpack" ] || continue
  filename=$(basename "$sfpack")
  pack_name="${filename%.sfpack}"
  echo "Processing ${filename}..."
  
  # Note: the download-url matches the path inside the docker container
  go run ./cmd/bun market-data packs registry-entry \
    --pack "$sfpack" \
    --download-url "file:///data/market-data/dist/${filename}" \
    --out "${DIST_DIR}/${pack_name}.registry.json"
done

echo "Aggregating and merging all registry entries into registry.json..."
python3 generate-combined-registry.py

echo "Registry generation complete: ${DIST_DIR}/registry.json"
