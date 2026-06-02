#!/usr/bin/env python3
import os
import sys
import zipfile
import argparse
import uuid
import time

def parse_args():
    parser = argparse.ArgumentParser(description="Auto-generate build specs and universes for all Stooq ZIP archives in a folder.")
    parser.add_argument("--zip-dir", default="data/market-data/stooq", help="Directory containing Stooq zip files (default: data/market-data/stooq)")
    parser.add_argument("--out-specs-dir", default="packs/specs", help="Output directory for YAML specs (default: packs/specs)")
    parser.add_argument("--out-univ-dir", default="packs/universes", help="Output directory for YAML universes (default: packs/universes)")
    parser.add_argument("--history-start", default="1800-01-01", help="Default start date for pack history (default: 1800-01-01)")
    return parser.parse_args()

def draw_progress_bar(current, total, prefix='', suffix='', bar_length=35):
    """Draw a clean, non-flooding line-by-line decile progress update."""
    percent = int(current * 100 / total) if total > 0 else 0
    if not hasattr(draw_progress_bar, "last_printed"):
        draw_progress_bar.last_printed = -1
        
    if percent % 10 == 0 and percent != draw_progress_bar.last_printed:
        clean_suffix = suffix[:25] + '...' if len(suffix) > 25 else suffix
        print(f"{prefix} | {percent}% ({current}/{total}) {clean_suffix}")
        draw_progress_bar.last_printed = percent

def clean_region_name(zip_name):
    base = zip_name.lower().replace(".zip", "")
    if base.startswith("d_"):
        base = base[2:]
    if base.endswith("_txt"):
        base = base[:-4]
    return f"{base}-stooq"

def main():
    args = parse_args()
    zip_dir = args.zip_dir
    specs_dir = args.out_specs_dir
    univ_dir = args.out_univ_dir

    if not os.path.exists(zip_dir):
        print(f"\033[31mError: ZIP directory not found at {zip_dir}\033[0m", file=sys.stderr)
        sys.exit(1)

    zip_files = [f for f in os.listdir(zip_dir) if f.lower().endswith('.zip')]
    if not zip_files:
        print(f"\033[31mError: No .zip archives found in {zip_dir}\033[0m", file=sys.stderr)
        sys.exit(1)

    os.makedirs(specs_dir, exist_ok=True)
    os.makedirs(univ_dir, exist_ok=True)

    print(f"\n🔍 Scanning \033[1;33m{len(zip_files)}\033[0m Stooq archives to generate specs and universes...")

    spec_paths = []

    for z_file in zip_files:
        zip_path = os.path.join(zip_dir, z_file)
        region_id = clean_region_name(z_file)
        pack_id = f"{region_id}-daily"
        
        print(f"\n📂 Scaffolding spec for: \033[1;36m{z_file}\033[0m (ID: {pack_id})")

        universe_file_name = f"{region_id}.yaml"
        universe_path = os.path.join(univ_dir, universe_file_name)
        spec_path = os.path.join(specs_dir, f"{pack_id}.yaml")

        symbols_list = []
        start_time = time.time()

        try:
            with zipfile.ZipFile(zip_path, 'r') as zf:
                namelist = zf.namelist()
                txt_files = [name for name in namelist if name.endswith('.txt') or name.endswith('.csv')]
                total_files = len(txt_files)
                
                if total_files == 0:
                    print("  ⚠️ No daily historical files found in this archive.")
                    continue

                processed_files = 0
                last_update_time = 0.0
                draw_progress_bar.last_printed = -1
                for name in txt_files:
                    lower_name = name.lower()
                    
                    # Detect Asset Type
                    if "stocks" in lower_name:
                        asset_type = "STOCK"
                    elif "etfs" in lower_name:
                        asset_type = "FUND"
                    else:
                        asset_type = "STOCK"

                    # Extract Symbol
                    base_filename = os.path.basename(name)
                    symbol = os.path.splitext(base_filename)[0].upper()
                    if not symbol:
                        continue

                    # Extract base asset (e.g. AAPL.US -> AAPL)
                    base_asset = symbol.split('.')[0]
                    # Estimate quote currency based on region
                    quote_currency = "USD"
                    if "world" in lower_name or "fr" in lower_name or "de" in lower_name or "hu" in lower_name:
                        quote_currency = "EUR"
                    elif "uk" in lower_name:
                        quote_currency = "GBP"
                    elif "pl" in lower_name:
                        quote_currency = "PLN"
                    elif "jp" in lower_name:
                        quote_currency = "JPY"
                    elif "hk" in lower_name:
                        quote_currency = "HKD"

                    # Generate static UUID based on namespace to keep it deterministic
                    namespace_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, f"{symbol}:{asset_type}:{quote_currency}")

                    symbols_list.append({
                        'instrument_id': str(namespace_uuid),
                        'symbol': symbol,
                        'base_asset': base_asset,
                        'quote_asset': quote_currency,
                        'asset_type': asset_type
                    })

                    # Update real-time progress bar (throttled to 0.2 seconds to avoid console flickering)
                    processed_files += 1
                    now = time.time()
                    if now - last_update_time >= 0.2 or processed_files == total_files:
                        draw_progress_bar(processed_files, total_files, prefix='  ⚡ Scanning', suffix=symbol)
                        last_update_time = now

        except Exception as e:
            print(f"\n  ❌ Error scanning zip: {e}", file=sys.stderr)
            continue

        if not symbols_list:
            sys.stdout.write('\r' + ' ' * 100 + '\r')
            print(f"  ⚠️ No valid files found in {z_file}; skipping.")
            continue

        # Clear progress bar
        sys.stdout.write('\r' + ' ' * 100 + '\r')
        elapsed = time.time() - start_time
        print(f"  ✅ Completed scanning in {elapsed:.1f}s")

        # 1. Write Universe YAML
        print(f"  ✍️ Writing universe ({len(symbols_list)} symbols) -> {universe_path}")
        with open(universe_path, 'w', encoding='utf-8') as uf:
            uf.write("symbols:\n")
            for sym in symbols_list:
                uf.write(f"  - instrument_id: \"{sym['instrument_id']}\"\n")
                uf.write(f"    symbol: \"{sym['symbol']}\"\n")
                uf.write(f"    base_asset: \"{sym['base_asset']}\"\n")
                uf.write(f"    quote_asset: \"{sym['quote_asset']}\"\n")
                uf.write(f"    asset_type: \"{sym['asset_type']}\"\n")

        # 2. Write Spec YAML
        print(f"  ✍️ Writing pack build spec -> {spec_path}")
        spec_name = region_id.replace("-", " ").title() + " Daily"
        with open(spec_path, 'w', encoding='utf-8') as sf:
            sf.write(f"pack_id: {pack_id}\n")
            sf.write(f"name: {spec_name}\n")
            sf.write(f"version: 2026.05.26\n")
            sf.write(f"format_version: 1\n")
            sf.write(f"distribution: local\n")
            sf.write(f"asset_type: STOCK\n")
            sf.write(f"interval: 1d\n")
            sf.write(f"quote_currency: {quote_currency}\n")
            sf.write(f"source_provider: marketparquet\n")
            sf.write(f"license_policy: marketparquet-local-only\n")
            sf.write(f"upload_forbidden: true\n")
            sf.write(f"generated_by_user: true\n")
            sf.write(f"install_mode: build_local\n")
            sf.write(f"history:\n")
            sf.write(f"  start: {args.history_start}\n")
            sf.write(f"  end: auto\n")
            sf.write(f"universe:\n")
            sf.write(f"  file: packs/universes/{universe_file_name}\n")
            sf.write(f"output:\n")
            sf.write(f"  compression: zstd\n")
            sf.write(f"  partition_by:\n")
            sf.write(f"    - asset_type\n")
            sf.write(f"    - quote_currency\n")
            sf.write(f"    - year\n")

        spec_paths.append(spec_path)

    print(f"\n🎉 \033[1;32mSCAFFOLD COMPLETE: Generated specs for {len(spec_paths)} regional packs!\033[0m")
    print(f"To build all regional packs in one command, run:")
    print("  cd server")
    print("  go run ./cmd/bun market-data packs build \\")
    print(f"    --spec \"{','.join(spec_paths)}\" \\")
    print("    --out ../dist \\")
    print("    --build-mode local_user_build \\")
    print("    --all \\")
    print("    --archive")

if __name__ == "__main__":
    main()
