#!/usr/bin/env python3
"""
Generate coverage bridging SQL for STOOQ packs.

This script scans STOOQ ZIP archives, extracts symbols, and produces
a SQL file that bridges market_data_pack_coverage rows to existing
FinanceDatabase instruments.  It does NOT create new instruments.

FinanceDatabase is the canonical instrument source.  STOOQ packs
contain data keyed by deterministic UUID5 instrument IDs that do not
match DB instrument IDs.  The bridging UPDATE statements repair
market_data_pack_coverage so that PackCandleStore can serve pack
data by DB instrument ID.

Bridging rules (per pack):
  - us-*, world-*, uk-*, hk-*, jp-*, pl-*, hu-* :
      Strip exchange suffix (e.g. "AAPL.US" → "AAPL") and match
      instruments by normalized_symbol + asset_type IN ('STOCK','ETF','FUND').
  - fx-* :
      Match by base_currency / quote_currency.
  - macro-* :
      Match by normalized_symbol to any asset_type.
"""

import os
import sys
import zipfile
import argparse
from collections import defaultdict

def parse_args():
    parser = argparse.ArgumentParser(
        description="Generate coverage bridging SQL for STOOQ packs."
    )
    parser.add_argument(
        "--zip-path", required=True,
        help="Path to Stooq ZIP file or directory containing multiple Stooq ZIP files"
    )
    parser.add_argument(
        "--out-sql", default="data/bridge_stooq_coverage.sql",
        help="Output SQL file path (default: data/bridge_stooq_coverage.sql)"
    )
    return parser.parse_args()

def clean_region_name(zip_name: str) -> str:
    """Derive region ID from ZIP filename for pack_id construction."""
    base = zip_name.lower().replace(".zip", "")
    if base.startswith("d_"):
        base = base[2:]
    if base.endswith("_txt"):
        base = base[:-4]
    return base

def derive_pack_id(region: str) -> str:
    """Map region ID to pack_id used in market_data_pack_coverage."""
    return f"{region}-stooq-daily"

def strip_exchange_suffix(symbol: str) -> str | None:
    """
    Remove exchange suffix if present (e.g. 'AAPL.US' → 'AAPL').

    Returns None when the symbol shouldn't be bridged at all.
    Returns the symbol unchanged when it has no recognisable suffix
    (e.g. '^SPX', '10YUSY.B' with .B suffix >3 chars, or bare symbols).

    The caller uses `stripped != symbol` to decide between suffix-strip
    and direct-match UPDATE blocks.
    """
    if not symbol:
        return None
    # Indices and special symbols — no stripping needed
    if symbol.startswith("^"):
        return symbol
    # exchange suffix like .US, .HK, .JP, .UK, .PL, .HU, .DE
    if "." in symbol:
        parts = symbol.rsplit(".", 1)
        suffix = parts[1]
        # Recognised 2-3 char alphabetic exchange suffix
        if 2 <= len(suffix) <= 3 and suffix.isalpha():
            return parts[0]
        # .B (bond), .V (volatility), or longer suffixes — keep as-is
    return symbol

def classify_bridging_strategy(region: str):
    """
    Return (asset_types_for_match, extra_where, symbol_transform).

    - 'stock': strip suffix, match STOCK/ETF/FUND
    - 'fx':    match by base/quote currency
    - 'macro': match by normalized_symbol, any asset_type
    """
    r = region.lower()
    if r.startswith("fx") or "fx" in r:
        return "fx"
    if r.startswith("macro") or "macro" in r:
        return "macro"
    return "stock"

def main():
    args = parse_args()
    zip_path = args.zip_path
    out_sql = args.out_sql

    if not os.path.exists(zip_path):
        print(f"Error: Target path not found at {zip_path}", file=sys.stderr)
        sys.exit(1)

    zip_files = []
    if os.path.isdir(zip_path):
        zip_files = [
            os.path.join(zip_path, f)
            for f in os.listdir(zip_path)
            if f.lower().endswith(".zip")
        ]
        if not zip_files:
            print(f"Error: No .zip files found in directory {zip_path}", file=sys.stderr)
            sys.exit(1)
    else:
        zip_files = [zip_path]

    # Group symbols by pack_id
    # pack_id → set of (symbol, asset_type)
    pack_symbols: dict[str, set[tuple[str, str]]] = defaultdict(set)

    print(f"Scanning {len(zip_files)} Stooq archive(s) for symbols...")

    for z_file in sorted(zip_files):
        region = clean_region_name(os.path.basename(z_file))
        pack_id = derive_pack_id(region)
        print(f"  Reading: {z_file}  →  pack_id={pack_id}")

        try:
            with zipfile.ZipFile(z_file, "r") as zf:
                for name in zf.namelist():
                    if not (name.endswith(".txt") or name.endswith(".csv")):
                        continue
                    lower_name = name.lower()

                    # Extract symbol
                    base_filename = os.path.basename(name)
                    symbol = os.path.splitext(base_filename)[0].upper()
                    if not symbol:
                        continue

                    # Detect asset type
                    if symbol.startswith("^"):
                        asset_type = "INDEX"
                    elif "etfs" in lower_name:
                        asset_type = "FUND"
                    elif "stocks" in lower_name:
                        asset_type = "STOCK"
                    else:
                        asset_type = "STOCK"

                    pack_symbols[pack_id].add((symbol, asset_type))
        except Exception as e:
            print(f"  Error scanning {z_file}: {e}", file=sys.stderr)

    if not pack_symbols:
        print("No symbols discovered. SQL generation aborted.")
        sys.exit(0)

    total_symbols = sum(len(s) for s in pack_symbols.values())
    print(f"\nTotal unique symbols across {len(pack_symbols)} packs: {total_symbols}")

    # --- Generate bridging SQL ---
    os.makedirs(os.path.dirname(out_sql) if os.path.dirname(out_sql) else ".", exist_ok=True)

    with open(out_sql, "w", encoding="utf-8") as f:
        f.write("-- ============================================================================\n")
        f.write("-- Coverage Bridging SQL — generated by seed_instruments_from_stooq.py\n")
        f.write("-- Bridges pack instrument IDs → FinanceDatabase instrument IDs\n")
        f.write("-- Apply AFTER packs are built and installed.\n")
        f.write("-- Safe to re-run: WHERE pack_instrument_id IS NULL ensures idempotency.\n")
        f.write("-- ============================================================================\n\n")
        f.write("BEGIN;\n\n")

        for pack_id in sorted(pack_symbols.keys()):
            symbols = sorted(pack_symbols[pack_id])
            region = pack_id.replace("-stooq-daily", "")
            strategy = classify_bridging_strategy(region)

            if strategy == "stock":
                # Two UPDATE blocks:
                #  A) Symbols with exchange suffix (.US, .HK, etc.) — strip and match
                #  B) Symbols without a recognisable suffix — direct symbol match
                # Both are guarded by pack_instrument_id IS NULL for idempotency.

                suffix_symbols = []   # (stripped, asset_type, original)
                direct_symbols = []   # (symbol, asset_type)

                for symbol, asset_type in symbols:
                    stripped = strip_exchange_suffix(symbol)
                    if stripped is None:
                        continue
                    if stripped != symbol:
                        suffix_symbols.append((stripped, asset_type, symbol))
                    else:
                        direct_symbols.append((symbol, asset_type))

                f.write(f"-- ── {pack_id} ({len(symbols)} symbols) ──\n")

                # Block A: strip exchange suffix
                if suffix_symbols:
                    f.write(f"--   {len(suffix_symbols)} with exchange suffix\n")
                    # Include original pack symbol for precise matching — avoids
                    # hardcoding suffix length in SUBSTRING expressions.
                    f.write(f"WITH suffix_map(pack_sym, stripped_sym, asset_type) AS (VALUES\n")
                    value_rows = []
                    for stripped, at, orig in suffix_symbols:
                        orig_esc = orig.replace("'", "''")
                        stripped_esc = stripped.replace("'", "''")
                        at_esc = at.replace("'", "''")
                        value_rows.append(
                            f"    ('{orig_esc}', '{stripped_esc}', '{at_esc}')"
                        )
                    f.write(",\n".join(value_rows))
                    f.write(r"""
),
sm_matched AS (
    SELECT DISTINCT ON (sm.pack_sym)
        sm.pack_sym,
        i.id AS db_instrument_id
    FROM suffix_map sm
    JOIN sigma_finance.instruments i
      ON LOWER(split_part(i.normalized_symbol, '.', 1)) = LOWER(sm.stripped_sym)
     AND (
       (sm.asset_type IN ('STOCK', 'FUND', 'ETF') AND i.asset_type IN ('STOCK', 'FUND', 'ETF'))
       OR
       (sm.asset_type = 'INDEX' AND i.asset_type = 'INDEX')
     )
    ORDER BY sm.pack_sym, i.name
)
UPDATE sigma_finance.market_data_pack_coverage mpc
SET instrument_id      = m.db_instrument_id,
    pack_instrument_id = mpc.instrument_id
FROM sm_matched m
WHERE mpc.pack_id = '""" + pack_id + """'
  AND mpc.symbol = m.pack_sym
  AND mpc.pack_instrument_id IS NULL;

""")

                # Block B: direct symbol match (indices, macro indicators, etc.)
                if direct_symbols:
                    f.write(f"--   {len(direct_symbols)} direct match (no suffix)\n")
                    f.write(f"WITH direct_map(sym, asset_type) AS (VALUES\n")
                    value_rows = [
                        f"    ('{s.replace(chr(39), chr(39)+chr(39))}', '{at.replace(chr(39), chr(39)+chr(39))}')"
                        for s, at in direct_symbols
                    ]
                    f.write(",\n".join(value_rows))
                    f.write(r"""
),
dm_matched AS (
    SELECT DISTINCT ON (dm.sym)
        dm.sym,
        i.id AS db_instrument_id
    FROM direct_map dm
    JOIN sigma_finance.instruments i
      ON LOWER(split_part(i.normalized_symbol, '.', 1)) = LOWER(dm.sym)
     AND (
       (dm.asset_type IN ('STOCK', 'FUND', 'ETF') AND i.asset_type IN ('STOCK', 'FUND', 'ETF'))
       OR
       (dm.asset_type = 'INDEX' AND i.asset_type = 'INDEX')
     )
    ORDER BY dm.sym, i.name
)
UPDATE sigma_finance.market_data_pack_coverage mpc
SET instrument_id      = m.db_instrument_id,
    pack_instrument_id = mpc.instrument_id
FROM dm_matched m
WHERE mpc.pack_id = '""" + pack_id + """'
  AND UPPER(mpc.symbol) = UPPER(m.sym)
  AND mpc.pack_instrument_id IS NULL;

""")

            elif strategy == "fx":
                # FX symbols like EURUSD, EURCHF — match by base/quote currency
                f.write(f"-- ── {pack_id} ({len(symbols)} symbols) FX ──\n")
                f.write(f"WITH fx_map(sym, base_ccy, quote_ccy) AS (VALUES\n")
                value_rows = []
                for symbol, asset_type in symbols:
                    sym = symbol.strip().upper()
                    if len(sym) != 6:
                        continue
                    base_ccy = sym[:3]
                    quote_ccy = sym[3:6]
                    value_rows.append(
                        f"    ('{sym}', '{base_ccy}', '{quote_ccy}')"
                    )
                f.write(",\n".join(value_rows))
                f.write(r"""
),
matched AS (
    SELECT DISTINCT ON (fm.sym)
        fm.sym,
        COALESCE(
            (SELECT i.id FROM sigma_finance.instruments i
             WHERE i.asset_type = 'CURRENCY'
               AND UPPER(i.base_currency) = UPPER(fm.base_ccy)
               AND UPPER(i.quote_currency) = UPPER(fm.quote_ccy)
             LIMIT 1),
            (SELECT i.id FROM sigma_finance.instruments i
             WHERE i.asset_type = 'CURRENCY'
               AND UPPER(i.base_currency) = UPPER(fm.quote_ccy)
               AND UPPER(i.quote_currency) = UPPER(fm.base_ccy)
             LIMIT 1)
        ) AS db_instrument_id
    FROM fx_map fm
)
UPDATE sigma_finance.market_data_pack_coverage mpc
SET instrument_id      = m.db_instrument_id,
    pack_instrument_id = mpc.instrument_id
FROM matched m
WHERE mpc.pack_id = '""" + pack_id + """'
  AND UPPER(mpc.symbol) = UPPER(m.sym)
  AND mpc.pack_instrument_id IS NULL
  AND m.db_instrument_id IS NOT NULL;

""")

            elif strategy == "macro":
                # Macro indicators — match by normalized_symbol, any asset_type
                f.write(f"-- ── {pack_id} ({len(symbols)} symbols) MACRO ──\n")
                f.write(f"WITH macro_map(sym) AS (VALUES\n")
                value_rows = []
                for symbol, asset_type in symbols:
                    escaped = symbol.replace("'", "''")
                    value_rows.append(f"    ('{escaped}')")
                f.write(",\n".join(value_rows))
                f.write(r"""
),
matched AS (
    SELECT DISTINCT ON (mm.sym)
        mm.sym,
        i.id AS db_instrument_id
    FROM macro_map mm
    JOIN sigma_finance.instruments i
      ON LOWER(split_part(i.normalized_symbol, '.', 1)) = LOWER(mm.sym)
    ORDER BY mm.sym, i.name
)
UPDATE sigma_finance.market_data_pack_coverage mpc
SET instrument_id      = m.db_instrument_id,
    pack_instrument_id = mpc.instrument_id
FROM matched m
WHERE mpc.pack_id = '""" + pack_id + """'
  AND UPPER(mpc.symbol) = UPPER(m.sym)
  AND mpc.pack_instrument_id IS NULL;

""")

        f.write("COMMIT;\n")

    print(f"\n✅ Bridging SQL written to: {out_sql}")
    print(f"   Apply after pack installation with:")
    print(f"   psql -h <host> -U <user> -d sigma_finance -f {out_sql}")

if __name__ == "__main__":
    main()
