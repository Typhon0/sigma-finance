#!/usr/bin/env python3
import os
import sys
import zipfile
import argparse
import time
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

# The exact target schema to match Go's marketparquet.DailyRow struct:
PARQUET_SCHEMA = pa.schema([
    ('timestamp', pa.timestamp('us')),
    ('symbol', pa.string()),
    ('asset_type', pa.string()),
    ('open', pa.float64()),
    ('high', pa.float64()),
    ('low', pa.float64()),
    ('close', pa.float64()),
    ('volume', pa.float64()),
])

def parse_args():
    parser = argparse.ArgumentParser(description="Ingest Stooq daily ASCII zip archive(s) and convert to date-partitioned Parquet files with dynamic memory monitoring.")
    parser.add_argument("--zip-path", required=True, help="Path to a single Stooq zip file OR a directory containing multiple Stooq zip files")
    parser.add_argument("--out-dir", default="data/marketparquet", help="Target import directory for MarketParquet (default: data/marketparquet)")
    parser.add_argument("--batch-size", type=int, default=1000, help="Backup check: flush data every N symbols (default: 1000)")
    parser.add_argument("--max-memory-mb", type=int, default=1024, help="Process RAM limit: auto-flush to disk when python process exceeds N megabytes (default: 1024)")
    parser.add_argument("--min-available-memory-mb", type=int, default=1024, help="System safety limit: auto-flush to disk if system available RAM drops below N megabytes (default: 1024)")
    return parser.parse_args()

def draw_progress_bar(current, total, prefix='', suffix='', bar_length=30):
    """Draw a clean, single-line progress update that overwrites the same line using \r."""
    percent = int(current * 100 / total) if total > 0 else 0
    filled_length = int(bar_length * current // total) if total > 0 else 0
    bar = '█' * filled_length + '░' * (bar_length - filled_length)
    
    clean_suffix = suffix[:25]
    if len(suffix) > 25:
        clean_suffix = clean_suffix[:22] + "..."
        
    status_line = f"\r{prefix} |{bar}| {percent}% ({current}/{total}) {clean_suffix}"
    
    # Pad to clear any previous text and keep length stable
    sys.stdout.write(f"{status_line:<115}")
    sys.stdout.flush()


def get_current_process_memory_mb():
    """Read the current resident memory (RSS) usage of the Python process dynamically in MB."""
    try:
        # Standard Linux process status lookup (zero dependencies)
        with open("/proc/self/status", "r") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    parts = line.split()
                    if len(parts) >= 2:
                        return float(parts[1]) / 1024.0 # KB to MB
    except Exception:
        pass
    return 0.0

def get_system_available_memory_mb():
    """Read the actual reclaimable available memory on the system dynamically in MB."""
    try:
        # Standard Linux system memory status lookup
        with open("/proc/meminfo", "r") as f:
            for line in f:
                if line.startswith("MemAvailable:"):
                    parts = line.split()
                    if len(parts) >= 2:
                        return float(parts[1]) / 1024.0 # KB to MB
    except Exception:
        pass
    return 0.0

def flush_batch_to_temp(data_rows, temp_dir, batch_state):
    """Save the accumulated list of row dictionaries directly to a temp batch parquet file and free RAM."""
    if not data_rows:
        return

    batch_index = batch_state[0]
    batch_state[0] += 1

    file_path = os.path.join(temp_dir, f"batch_{batch_index}.parquet")

    df = pd.DataFrame(data_rows)

    # Force schema alignment
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df['symbol'] = df['symbol'].astype(str)
    df['asset_type'] = df['asset_type'].astype(str)
    df['open'] = df['open'].astype(float)
    df['high'] = df['high'].astype(float)
    df['low'] = df['low'].astype(float)
    df['close'] = df['close'].astype(float)
    df['volume'] = df['volume'].astype(float)

    table = pa.Table.from_pandas(df, schema=PARQUET_SCHEMA)
    pq.write_table(table, file_path, compression='zstd')

    # Fully clear list to release memory references
    data_rows.clear()

def partition_temp_batches_to_final(out_dir):
    """Consolidate the temporary batches into the final date-partitioned parquet files year-by-year."""
    temp_dir = os.path.join(out_dir, "temp_batches")
    if not os.path.exists(temp_dir) or not os.listdir(temp_dir):
        return

    print(f"\n⚡ Consolidating and date-partitioning data packs...")
    
    import datetime

    # Dynamically scan the temporary batch files to find all unique years having data
    detected_years = set()
    for filename in os.listdir(temp_dir):
        if filename.endswith(".parquet"):
            try:
                file_path = os.path.join(temp_dir, filename)
                pf = pq.ParquetFile(file_path)
                meta = pf.metadata
                for rg_idx in range(meta.num_row_groups):
                    rg = meta.row_group(rg_idx)
                    col = rg.column(0) # 'timestamp' is column 0
                    if col.statistics and col.statistics.has_min_max:
                        min_val = col.statistics.min
                        max_val = col.statistics.max
                        if hasattr(min_val, 'year'):
                            detected_years.add(min_val.year)
                        elif hasattr(min_val, 'as_py'):
                            min_py = min_val.as_py()
                            if hasattr(min_py, 'year'):
                                detected_years.add(min_py.year)
                        if hasattr(max_val, 'year'):
                            detected_years.add(max_val.year)
                        elif hasattr(max_val, 'as_py'):
                            max_py = max_val.as_py()
                            if hasattr(max_py, 'year'):
                                detected_years.add(max_py.year)
            except Exception:
                pass

    if detected_years:
        years_list = sorted(list(range(min(detected_years), max(detected_years) + 1)))
        print(f"📊 [Ingestion] Dynamically detected year range: {min(detected_years)} to {max(detected_years)}")
    else:
        years_list = sorted(list(range(1985, time.localtime().tm_year + 1)))
        print(f"📊 [Ingestion] No years detected, defaulting to standard range: 1985 to {time.localtime().tm_year}")
    
    for year in years_list:
        start_dt = datetime.datetime(year, 1, 1, 0, 0, 0)
        end_dt = datetime.datetime(year, 12, 31, 23, 59, 59)

        try:
            # Read all batch parquet files for the target year
            table = pq.read_table(
                temp_dir,
                filters=[
                    ('timestamp', '>=', start_dt),
                    ('timestamp', '<=', end_dt)
                ]
            )
        except Exception as e:
            if "empty" not in str(e).lower():
                print(f"   ⚠️ Skipping year {year}: {e}")
            continue

        if table.num_rows == 0:
            continue

        print(f"   • Processing year {year} ({table.num_rows} rows)...")
        df = table.to_pandas()

        # Format timestamps to YYYY-MM-DD for date partitioning
        df['date_str'] = df['timestamp'].dt.strftime('%Y-%m-%d')

        grouped = df.groupby(['date_str', 'asset_type'])
        for (date_str, asset_type), group in grouped:
            sub_folder = "stock_daily" if asset_type == "STOCK" else "etf_daily"
            file_path = os.path.join(out_dir, "by_date", sub_folder, f"{date_str}.parquet")

            group_to_write = group.drop(columns=['date_str'])

            # Merge with existing file if it exists
            if os.path.exists(file_path):
                try:
                    df_existing = pd.read_parquet(file_path)
                    group_to_write = pd.concat([df_existing, group_to_write], ignore_index=True)
                    group_to_write = group_to_write.drop_duplicates(subset=['symbol'])
                except Exception:
                    pass

            # Force schema alignment
            group_to_write['timestamp'] = pd.to_datetime(group_to_write['timestamp'])
            group_to_write['symbol'] = group_to_write['symbol'].astype(str)
            group_to_write['asset_type'] = group_to_write['asset_type'].astype(str)
            group_to_write['open'] = group_to_write['open'].astype(float)
            group_to_write['high'] = group_to_write['high'].astype(float)
            group_to_write['low'] = group_to_write['low'].astype(float)
            group_to_write['close'] = group_to_write['close'].astype(float)
            group_to_write['volume'] = group_to_write['volume'].astype(float)

            table_to_write = pa.Table.from_pandas(group_to_write, schema=PARQUET_SCHEMA)
            pq.write_table(table_to_write, file_path, compression='zstd')

    # Cleanup temporary batches
    print(f"🧹 Cleaning up temporary batch files...")
    for f in os.listdir(temp_dir):
        try:
            os.remove(os.path.join(temp_dir, f))
        except Exception:
            pass
    try:
        os.rmdir(temp_dir)
    except Exception:
        pass
    print(f"✅ Phase 2 complete! All files fully consolidated.")

def process_zip_file(zip_path, temp_dir, data_rows, batch_state, batch_size, max_memory_mb, min_available_mb):
    zip_name = os.path.basename(zip_path)
    print(f"\n📂 Processing archive: \033[1;36m{zip_name}\033[0m")

    # Reset progress tracking decile for the new zip file
    draw_progress_bar.last_printed = -1

    start_time = time.time()

    with zipfile.ZipFile(zip_path, 'r') as zf:
        namelist = zf.namelist()
        txt_files = [name for name in namelist if name.endswith('.txt') or name.endswith('.csv')]
        total_files = len(txt_files)

        if total_files == 0:
            print("  ⚠️ No daily historical files found in this archive.")
            return

        processed_files = 0
        last_update_time = 0.0
        for name in txt_files:
            lower_name = name.lower()

            # Detect Asset Type
            if "stocks" in lower_name:
                asset_type = "STOCK"
            elif "etfs" in lower_name:
                asset_type = "FUND"
            else:
                asset_type = "STOCK"

            base_filename = os.path.basename(name)
            ticker = os.path.splitext(base_filename)[0].upper()

            processed_files += 1
            now = time.time()

            # Time-throttled progress updates to keep the console highly responsive and user-friendly
            if now - last_update_time >= 0.2 or processed_files == total_files:
                proc_mem = get_current_process_memory_mb()
                sys_avail = get_system_available_memory_mb()
                draw_progress_bar(processed_files, total_files, prefix=f'  ⚡ Ingesting (Proc:{proc_mem:.0f}MB, SysFree:{sys_avail:.0f}MB)', suffix=ticker)
                last_update_time = now

            try:
                with zf.open(name) as f:
                    df = pd.read_csv(f)
                    if df.empty:
                        continue

                    # Clean headers
                    df.columns = [col.strip().lower().replace('<', '').replace('>', '') for col in df.columns]

                    if 'date' not in df.columns:
                        continue

                    df['parsed_date'] = pd.to_datetime(df['date'], format='%Y%m%d', errors='coerce')
                    if df['parsed_date'].isna().all():
                        df['parsed_date'] = pd.to_datetime(df['date'], errors='coerce')
                    df = df.dropna(subset=['parsed_date'])

                    # Store timestamps as Python datetime objects directly
                    timestamps = df['parsed_date'].tolist()
                    opens = df['open'].astype(float).tolist()
                    highs = df['high'].astype(float).tolist()
                    lows = df['low'].astype(float).tolist()
                    closes = df['close'].astype(float).tolist()

                    vol_col = 'volume' if 'volume' in df.columns else ('vol' if 'vol' in df.columns else None)
                    volumes = df[vol_col].astype(float).tolist() if vol_col else [0.0] * len(df)

                    for ts, o, h, l, c, v in zip(timestamps, opens, highs, lows, closes, volumes):
                        data_rows.append({
                            'timestamp': ts,
                            'symbol': ticker,
                            'asset_type': asset_type,
                            'open': o,
                            'high': h,
                            'low': l,
                            'close': c,
                            'volume': v
                        })

            except Exception:
                pass

            # Double-Dynamic Memory Invalidation & Disk Flush
            if sys_avail < min_available_mb:
                # System-level safety override
                sys.stdout.write('\r' + ' ' * 115 + '\r')
                print(f"  💾 Sys RAM Low ({sys_avail:.0f}MB < {min_available_mb}MB) - Emergency Flush...")
                flush_batch_to_temp(data_rows, temp_dir, batch_state)
                last_update_time = time.time()
            elif proc_mem >= max_memory_mb:
                # Process-level safety threshold
                sys.stdout.write('\r' + ' ' * 115 + '\r')
                print(f"  💾 Proc RAM Limit ({proc_mem:.0f}MB > {max_memory_mb}MB) - Cache Flush...")
                flush_batch_to_temp(data_rows, temp_dir, batch_state)
                last_update_time = time.time()
            # Fallback batch flushing: flush if row count is high
            elif len(data_rows) >= 2000000:
                sys.stdout.write('\r' + ' ' * 115 + '\r')
                print(f"  💾 High Row Count ({len(data_rows):,} rows) - Flushing Batch...")
                flush_batch_to_temp(data_rows, temp_dir, batch_state)
                last_update_time = time.time()

        elapsed = time.time() - start_time
        speed = total_files / elapsed if elapsed > 0 else 0
        sys.stdout.write('\r' + ' ' * 100 + '\r') # Clear progress bar line
        print(f"  ✅ Completed \033[32m{zip_name}\033[0m in {elapsed:.1f}s ({speed:.1f} files/sec)")

def main():
    args = parse_args()
    zip_path = args.zip_path
    out_dir = args.out_dir
    batch_size = args.batch_size
    sys_avail = get_system_available_memory_mb()
    # Subtract a 1GB safety margin (1024MB marge d'erreur) to make sure system stays responsive
    usable_sys_avail = max(sys_avail - 1024, 1024)
    # Dynamic Process Memory Cap: scale up max_memory_mb if system has high available memory
    if args.max_memory_mb == 1024 and usable_sys_avail > 1024:
        # Scale limit to 30% of usable free RAM, bounded between 1024MB and 4096MB
        dynamic_limit = int(usable_sys_avail * 0.30)
        max_memory_mb = min(max(dynamic_limit, 1024), 4096)
    else:
        max_memory_mb = args.max_memory_mb
    min_available_mb = args.min_available_memory_mb
    
    print(f"\n📊 [Memory Status] System Available RAM: {sys_avail:.0f} MB")
    print(f"📊 [Memory Status] Responsive Safety Margin: 1024 MB")
    print(f"📊 [Memory Status] System Safety Floor Limit (min_available): {min_available_mb} MB")
    print(f"📊 [Memory Status] Process Flush Threshold: {max_memory_mb} MB")

    if not os.path.exists(zip_path):
        print(f"\033[31mError: Target path not found at {zip_path}\033[0m", file=sys.stderr)
        sys.exit(1)

    zip_files = []
    if os.path.isdir(zip_path):
        print(f"\n🔍 Scanning directory for Stooq daily archives: \033[1;33m{zip_path}\033[0m")
        zip_files = [os.path.join(zip_path, f) for f in os.listdir(zip_path) if f.lower().endswith('.zip')]
        if not zip_files:
            print(f"\033[31mError: No .zip files found in directory {zip_path}\033[0m", file=sys.stderr)
            sys.exit(1)
        print(f"   Found {len(zip_files)} archives to ingest.")
    else:
        zip_files = [zip_path]

    stock_dir = os.path.join(out_dir, "by_date", "stock_daily")
    etf_dir = os.path.join(out_dir, "by_date", "etf_daily")
    os.makedirs(stock_dir, exist_ok=True)
    os.makedirs(etf_dir, exist_ok=True)

    temp_dir = os.path.join(out_dir, "temp_batches")
    os.makedirs(temp_dir, exist_ok=True)

    total_start = time.time()
    data_rows = []
    batch_state = [0]

    for z_file in zip_files:
        try:
            process_zip_file(z_file, temp_dir, data_rows, batch_state, batch_size, max_memory_mb, min_available_mb)
        except Exception as e:
            print(f"\n❌ Error processing zip file {z_file}: {e}", file=sys.stderr)

    # Flush final remaining records
    if data_rows:
        print("\n💾 Saving final batch to disk...")
        flush_batch_to_temp(data_rows, temp_dir, batch_state)

    # Phase 2: Year-by-year consolidation and final partitioning
    partition_temp_batches_to_final(out_dir)

    total_elapsed = time.time() - total_start
    print(f"\n🎉 \033[1;32mSUCCESS: Stooq Ingestion Pipeline Complete!\033[0m")
    print(f"   • Total Time Elapsed: {total_elapsed:.1f} seconds")
    print(f"   • Stock Parquet Path: {stock_dir}")
    print(f"   • ETF/Fund Parquet Path: {etf_dir}\n")

if __name__ == "__main__":
    main()
