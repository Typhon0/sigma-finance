#!/usr/bin/env bash
# Run yfinance-service integration tests inside the Docker container.
#
# Usage:
#   ./run_tests.sh              # Run all tests
#   ./run_tests.sh --cov        # Run with coverage report
#
# Prerequisites:
#   - The yfinance-service container must be running:
#       docker compose up -d yfinance-service
#
# Note: mypy type checking is enforced during `docker compose build`
# (dev stage). If the build succeeds, types are clean.
#
# Proto sync check: verify that committed proto stubs match the .proto source.
# Run with --check-proto to enable (requires grpcio-tools + mypy-protobuf).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

# Check proto sync if requested (or if tools are available)
if [[ "${1:-}" == "--check-proto" ]] || command -v protoc-gen-mypy &>/dev/null; then
    echo ">>> Checking proto stubs are in sync with .proto source..."
    (cd "$SCRIPT_DIR" && ./generate_proto.sh --check) || {
        echo "ERROR: Proto stubs are stale. Run ./generate_proto.sh to update."
        exit 1
    }
fi

# Ensure the container is running
if ! docker compose -f "$PROJECT_ROOT/docker-compose.yml" ps yfinance-service --format json 2>/dev/null | grep -q '"Running"'; then
    echo ">>> Starting yfinance-service container..."
    docker compose -f "$PROJECT_ROOT/docker-compose.yml" up -d yfinance-service
    sleep 5
fi

# Run the tests (pytest+pandas+numpy are already in the runtime image)
echo ">>> Running integration tests..."
COV_FLAG=""
if [[ "${1:-}" == "--cov" ]]; then
    COV_FLAG="--cov=servicer --cov-report=term-missing"
fi

docker compose -f "$PROJECT_ROOT/docker-compose.yml" exec yfinance-service \
    python -m pytest tests/ -v --tb=short $COV_FLAG

echo ">>> All checks complete."
