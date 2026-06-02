#!/usr/bin/env python3
import os
import json
import glob
import urllib.request

DIST_DIR = "/home/dev/repos/sigma-finance/data/market-data/dist"
REMOTE_REGISTRY_URL = "https://github.com/Typhon0/sigma-finance/releases/latest/download/registry.json"

def main():
    print("Fetching remote registry from:", REMOTE_REGISTRY_URL)
    
    packs = []
    latest_version = "local-build"
    
    try:
        req = urllib.request.Request(
            REMOTE_REGISTRY_URL, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            remote_data = json.loads(response.read().decode('utf-8'))
            packs = remote_data.get("packs", [])
            latest_version = remote_data.get("latest_version", "local-build")
            print(f"Loaded {len(packs)} packs from remote registry.")
    except Exception as e:
        print("Warning: Failed to fetch remote registry:", e)
        print("Proceeding with local-only packs.")
    
    # Read local registry entries
    local_files = glob.glob(os.path.join(DIST_DIR, "*.registry.json"))
    for filepath in local_files:
        filename = os.path.basename(filepath)
        if filename == "registry.json":
            continue
        try:
            with open(filepath, 'r') as f:
                pack_entry = json.load(f)
                # Avoid duplicates
                pack_id = pack_entry.get("pack_id")
                version = pack_entry.get("version")
                # Remove if already exists from remote
                packs = [p for p in packs if not (p.get("pack_id") == pack_id and p.get("version") == version)]
                packs.append(pack_entry)
                print(f"Added local pack: {pack_id} ({version})")
        except Exception as e:
            print(f"Error reading {filepath}: {e}")
            
    # Write the combined registry
    output_path = os.path.join(DIST_DIR, "registry.json")
    combined_registry = {
        "latest_version": latest_version,
        "packs": packs
    }
    
    with open(output_path, 'w') as f:
        json.dump(combined_registry, f, indent=2)
        
    print(f"Successfully wrote combined registry to {output_path} with {len(packs)} total packs.")

if __name__ == "__main__":
    main()
