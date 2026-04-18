#!/usr/bin/env bash
# generate_proto.sh — Regenerate Python protobuf code and mypy stubs from .proto source.
#
# Usage:
#   ./generate_proto.sh              # Generate into proto/ (default)
#   ./generate_proto.sh /custom/out  # Generate into custom directory
#   ./generate_proto.sh --check     # Verify committed stubs match .proto source
#
# Prerequisites:
#   pip install grpcio-tools mypy-protobuf
#
# This script must be run from the yfinance-service directory.
# The .proto source lives at the project root: ../../../proto/market_data.proto
#
# CI integration:
#   Run ./generate_proto.sh --check to fail the build if committed stubs
#   are out of sync with the .proto source file.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

# --- Check mode: verify committed stubs match .proto source ---
if [[ "${1:-}" == "--check" ]]; then
    echo ">>> Checking that committed proto stubs are in sync with .proto source..."
    TMP_DIR=$(mktemp -d)
    trap 'rm -rf "${TMP_DIR}"' EXIT

    # Generate into temp directory
    python -m grpc_tools.protoc \
        -I"${PROJECT_ROOT}" \
        --python_out="${TMP_DIR}" \
        --grpc_python_out="${TMP_DIR}" \
        --mypy_out="${TMP_DIR}" \
        --mypy_grpc_out="${TMP_DIR}" \
        proto/market_data.proto

    # Diff generated files against committed ones
    MISMATCH=0
    for ext in py pyi; do
        for f in "${TMP_DIR}/proto"/market_data_pb2*.${ext}; do
            basename=$(basename "${f}")
            committed="${SCRIPT_DIR}/proto/${basename}"
            if ! diff -q "${f}" "${committed}" >/dev/null 2>&1; then
                echo "ERROR: ${basename} is out of sync with .proto source"
                diff "${f}" "${committed}" || true
                MISMATCH=1
            fi
        done
    done

    if [[ ${MISMATCH} -eq 1 ]]; then
        echo ""
        echo "Committed proto stubs are stale. Run ./generate_proto.sh to update them."
        exit 1
    fi

    echo ">>> Proto stubs are in sync with .proto source."
    exit 0
fi

# --- Generate mode ---
# Output goes to the yfinance-service directory (parent of proto/),
# so that protoc creates proto/market_data_pb2.py with the correct
# "from proto import market_data_pb2" import path.
OUTPUT_DIR="${1:-${SCRIPT_DIR}}"

echo ">>> Generating protobuf Python code and mypy stubs..."
echo "    Proto source : ${PROJECT_ROOT}/proto/market_data.proto"
echo "    Output dir   : ${OUTPUT_DIR}/proto/"

# Ensure proto output subdirectory exists
mkdir -p "${OUTPUT_DIR}/proto"

# Use grpc_tools.protoc (bundled protoc, no system protoc needed).
# -I points to the project root so the proto file is referenced as
#   proto/market_data.proto. Since --*_out points to the yfinance-service
#   dir (parent of proto/), protoc creates proto/market_data_pb2.py with
#   the correct "from proto import market_data_pb2" import path.
# --mypy_out / --mypy_grpc_out generate .pyi type stubs via mypy-protobuf.
python -m grpc_tools.protoc \
    -I"${PROJECT_ROOT}" \
    --python_out="${OUTPUT_DIR}" \
    --grpc_python_out="${OUTPUT_DIR}" \
    --mypy_out="${OUTPUT_DIR}" \
    --mypy_grpc_out="${OUTPUT_DIR}" \
    proto/market_data.proto

echo ">>> Generated files:"
ls -1 "${OUTPUT_DIR}/proto"/market_data_pb2*.py "${OUTPUT_DIR}/proto"/market_data_pb2*.pyi 2>/dev/null
echo ">>> Done."
