#!/usr/bin/env python3
import os
import sys
import zipfile
import argparse

def parse_args():
    parser = argparse.ArgumentParser(description="Generate SQL seeding script for the instruments database table from Stooq ZIP archives.")
    parser.add_argument("--zip-path", required=True, help="Path to Stooq zip file or directory containing multiple Stooq zip files")
    parser.add_argument("--out-sql", default="data/seed_stooq_instruments.sql", help="Output SQL script path (default: data/seed_stooq_instruments.sql)")
    return parser.parse_args()

def main():
    args = parse_args()
    zip_path = args.zip_path
    out_sql = args.out_sql

    if not os.path.exists(zip_path):
        print(f"Error: Target path not found at {zip_path}", file=sys.stderr)
        sys.exit(1)

    # Detect if path is a file or directory
    zip_files = []
    if os.path.isdir(zip_path):
        zip_files = [os.path.join(zip_path, f) for f in os.listdir(zip_path) if f.lower().endswith('.zip')]
        if not zip_files:
            print(f"Error: No .zip files found in directory {zip_path}", file=sys.stderr)
            sys.exit(1)
    else:
        zip_files = [zip_path]

    # In-memory deduplicated collection of instruments
    # Key: (symbol, exchange) -> {name, asset_type, exchange}
    discovered_instruments = {}

    print(f"Scanning {len(zip_files)} Stooq archives for tickers...")

    for z_file in zip_files:
        print(f"Reading: {z_file}")
        try:
            with zipfile.ZipFile(z_file, 'r') as zf:
                for name in zf.namelist():
                    if not (name.endswith('.txt') or name.endswith('.csv')):
                        continue
                    
                    lower_name = name.lower()
                    
                    # 1. Detect Exchange & Asset Type from Stooq's folder layout
                    exchange = "GLOBAL_EXCHANGE"
                    asset_type = "STOCK"

                    if "nasdaq stocks" in lower_name:
                        exchange = "NASDAQ"
                        asset_type = "STOCK"
                    elif "nyse stocks" in lower_name:
                        exchange = "NYSE"
                        asset_type = "STOCK"
                    elif "nyse mkt stocks" in lower_name:
                        exchange = "NYSE_MKT"
                        asset_type = "STOCK"
                    elif "us etfs" in lower_name:
                        exchange = "US_ETFS"
                        asset_type = "FUND"
                    elif "london stocks" in lower_name or "/uk/" in lower_name:
                        exchange = "LSE"
                        asset_type = "STOCK"
                    elif "tokyo stocks" in lower_name or "/jp/" in lower_name:
                        exchange = "TSE"
                        asset_type = "STOCK"
                    elif "warsaw stocks" in lower_name or "/pl/" in lower_name:
                        exchange = "WSE"
                        asset_type = "STOCK"
                    elif "/fr/" in lower_name or "paris stocks" in lower_name:
                        exchange = "EURONEXT_PARIS"
                        asset_type = "STOCK"
                    elif "/de/" in lower_name:
                        exchange = "XETRA"
                        asset_type = "STOCK"
                    elif "world/etfs" in lower_name or "world etfs" in lower_name:
                        exchange = "WORLD_ETFS"
                        asset_type = "FUND"
                    
                    # 2. Extract symbol from file name
                    base_filename = os.path.basename(name)
                    symbol = os.path.splitext(base_filename)[0].upper()
                    if not symbol:
                        continue

                    # 3. Clean Symbol and Name
                    # e.g., 'AAPL.US' -> Symbol: AAPL.US, Name: AAPL
                    name_clean = symbol.split('.')[0]

                    key = (symbol, exchange)
                    if key not in discovered_instruments:
                        discovered_instruments[key] = {
                            'symbol': symbol,
                            'name': name_clean,
                            'exchange': exchange,
                            'asset_type': asset_type
                        }
        except Exception as e:
            print(f"Error scanning {z_file}: {e}", file=sys.stderr)

    total_discovered = len(discovered_instruments)
    print(f"Total unique instruments discovered: {total_discovered}")

    if total_discovered == 0:
        print("No instruments discovered. SQL generation aborted.")
        sys.exit(0)

    # 4. Write SQL script
    print(f"Writing SQL seeding script to {out_sql}...")
    os.makedirs(os.path.dirname(out_sql), exist_ok=True)

    with open(out_sql, 'w', encoding='utf-8') as f:
        f.write("-- SQL Seed Script generated from Stooq daily archives\n")
        f.write("-- Placed under sigma_finance.instruments\n\n")
        f.write("BEGIN;\n\n")
        
        # Batch inserts to make loading extremely fast
        batch_size = 500
        items = list(discovered_instruments.values())
        
        for i in range(0, len(items), batch_size):
            batch = items[i:i+batch_size]
            f.write("INSERT INTO sigma_finance.instruments (\n")
            f.write("    id, symbol, normalized_symbol, name, normalized_name, exchange, asset_type, status, provider_source, created_at, updated_at\n")
            f.write(") VALUES\n")
            
            value_rows = []
            for item in batch:
                sym = item['symbol'].replace("'", "''")
                nm = item['name'].replace("'", "''")
                exch = item['exchange'].replace("'", "''")
                at = item['asset_type']
                
                row_str = f"    (gen_random_uuid(), '{sym}', '{sym.lower()}', '{nm}', '{nm.lower()}', '{exch}', '{at}', 'ACTIVE', 'stooq', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
                value_rows.append(row_str)
            
            f.write(",\n".join(value_rows))
            f.write("\nON CONFLICT (symbol, exchange) DO NOTHING;\n\n")
        
        f.write("COMMIT;\n")

    print(f"Successfully generated database seed script!")
    print(f"To seed your local database, run:")
    print(f"  psql -h localhost -U postgres -d sigma_finance -f {out_sql}")

if __name__ == "__main__":
    main()
