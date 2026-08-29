#!/usr/bin/env bash
# tools/build_stooq_packs.sh
# All-in-one script to ingest, scaffold, and compile Stooq .sfpack files in one command.

set -euo pipefail

# ANSI color codes
CYAN='\033[1;36m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
NC='\033[0m' # No Color

ZIP_DIR="${1:-data/market-data/stooq}"
OUT_DIR="${2:-dist}"
PARQUET_DIR="data/marketparquet"

echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN}🚀 Starting SigmaFinance All-in-One Stooq Pack Ingestion & Build Pipeline${NC}"
echo -e "${CYAN}======================================================================${NC}\n"

# Verify tools exist
if [ ! -f "./tools/ingest_stooq.py" ] || [ ! -f "./tools/generate_specs_from_stooq.py" ] || [ ! -f "./tools/seed_instruments_from_stooq.py" ]; then
    echo -e "${RED}Error: Ingestion utility scripts are missing under ./tools/ folder. Aborting.${NC}"
    exit 1
fi

# Step 1: Ingest ZIP files to Parquet
echo -e "${YELLOW}[Step 1/4] Ingesting ZIP files to date-partitioned Parquet...${NC}"
./tools/ingest_stooq.py --zip-path "$ZIP_DIR" --out-dir "$PARQUET_DIR"

# Step 2: Auto-generate build specs and universes
echo -e "\n${YELLOW}[Step 2/4] Scaffolding specs and universes from ZIP archives...${NC}"
./tools/generate_specs_from_stooq.py --zip-dir "$ZIP_DIR"

# Discover the generated specs
SPEC_FILES=$(find packs/specs -name "*-stooq-daily.yaml" | sort)

if [ -z "$SPEC_FILES" ]; then
    echo -e "${RED}Error: No spec files were found. Aborting.${NC}"
    exit 1
fi

# Step 3: Run the Go backend pack builder per-spec (each region has different quote_currency)
# Large packs (>5000 symbols) are capped dynamically based on system free memory to prevent OOM.
if [ -f /proc/meminfo ]; then
    MEM_AVAILABLE_KB=$(grep "MemAvailable" /proc/meminfo | awk '{print $2}')
    MEM_AVAILABLE_MB=$((MEM_AVAILABLE_KB / 1024))
else
    MEM_AVAILABLE_MB=4000
fi

# We subtract a 1024MB (1GB) safety margin/buffer to ensure the system remains fully responsive.
USABLE_MEM_MB=$((MEM_AVAILABLE_MB - 1024))
if [ "$USABLE_MEM_MB" -lt 1024 ]; then
    USABLE_MEM_MB=1024
fi

# Calculate GOMEMLIMIT soft cap for the Go runtime (90% of USABLE_MEM_MB)
GO_MEM_LIMIT_MB=$((USABLE_MEM_MB * 9 / 10))

echo -e "\n📊 [Memory Status] System Available RAM: ${GREEN}${MEM_AVAILABLE_MB} MB${NC}"
echo -e "📊 [Memory Status] Responsive Safety Margin: ${GREEN}1024 MB${NC}"
echo -e "📊 [Memory Status] Usable RAM for Builder: ${GREEN}${USABLE_MEM_MB} MB${NC}"
echo -e "📊 [Memory Status] Go Runtime Memory Soft Limit (GOMEMLIMIT): ${GREEN}${GO_MEM_LIMIT_MB} MiB${NC}"
echo -e "📊 [Memory Status] Symbol Cap: ${GREEN}NONE (Building ALL symbols)${NC}"
echo -e "\n${YELLOW}[Step 3/4] Compiling binary .sfpack daily charts per region (all symbols)...${NC}"

cd server
for SPEC in $SPEC_FILES; do
    PACK_NAME=$(basename "$SPEC" .yaml)
    echo -e "\n   • Building ${CYAN}${PACK_NAME}${NC} from ${SPEC}..."
    # Run the compiler with strict memory boundaries: GOMEMLIMIT restricts peak memory, GOGC forces aggressive GC
    # We pass --all to build every single symbol in the universe YAML files
    GOMEMLIMIT="${GO_MEM_LIMIT_MB}MiB" GOGC=50 go run ./cmd/bun market-data packs build \
      --spec "$SPEC" \
      --out "../$OUT_DIR" \
      --build-mode local_user_build \
      --source-base-url "../$PARQUET_DIR" \
      --all \
      --archive
done
cd ..  # return to project root after building in server/

echo -e "\n${GREEN}======================================================================${NC}"
echo -e "${GREEN}🎉 SUCCESS: All regional .sfpack archives generated in ${OUT_DIR}/${NC}"
echo -e "${GREEN}======================================================================${NC}\n"

# Step 4: Generate and optionally apply coverage bridging SQL.
# Bridges pack instrument IDs → FinanceDatabase instrument IDs so
# pack candle data is queryable by DB instrument ID.  The server also
# resolves coverage dynamically at query time (via LIKE patterns in
# ListCoverage), but pre-bridging gives faster exact-ID lookups.
BRIDGE_SQL="data/bridge_stooq_coverage.sql"
echo -e "${YELLOW}[Step 4/4] Generating coverage bridging SQL...${NC}"
./tools/seed_instruments_from_stooq.py --zip-path "$ZIP_DIR" --out-sql "$BRIDGE_SQL"

if [ -n "${PGHOST:-}" ] && [ -n "${PGDATABASE:-}" ] && [ -n "${PGUSER:-}" ]; then
    echo -e "  🔗 Database connection detected — applying bridging SQL..."
    if PGPASSWORD="${PGPASSWORD:-}" psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -f "$BRIDGE_SQL" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✅ Coverage bridging applied.${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Bridging SQL apply failed — dynamic resolution will handle it at query time.${NC}"
        echo -e "  ${YELLOW}   Apply manually: psql -f ${BRIDGE_SQL}${NC}"
    fi
else
    echo -e "  ${YELLOW}ℹ️  No DB connection (set PGHOST/PGDATABASE/PGUSER to auto-apply).${NC}"
    echo -e "  ${YELLOW}   Bridging SQL saved to ${BRIDGE_SQL} — apply after pack install.${NC}"
    echo -e "  ${YELLOW}   The server will resolve coverage dynamically until then.${NC}"
fi
