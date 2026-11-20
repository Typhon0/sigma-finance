#!/usr/bin/env python3
"""
Downloads official French Carte des Loyers 2025 datasets from data.gouv.fr,
normalizes columns, replaces decimal commas with dots, merges the 4 datasets
(app, app12, app3, mai), and outputs a compact gzipped CSV.
"""
import csv
import gzip
import io
import os
import sys
import urllib.request

DATASETS = {
    "app": "https://static.data.gouv.fr/resources/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025/20251211-145010/pred-app-mef-dhup.csv",
    "app12": "https://static.data.gouv.fr/resources/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025/20251211-144934/pred-app12-mef-dhup.csv",
    "app3": "https://static.data.gouv.fr/resources/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025/20251211-144951/pred-app3-mef-dhup.csv",
    "mai": "https://static.data.gouv.fr/resources/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025/20251211-145039/pred-mai-mef-dhup.csv",
}

def parse_float(val):
    if not val:
        return None
    val = val.strip().replace(",", ".")
    try:
        f = float(val)
        return round(f, 2)
    except ValueError:
        return None

def fetch_and_parse(url):
    print(f"Fetching {url}...")
    req = urllib.request.Request(url, headers={"User-Agent": "SigmaFinance/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        content = resp.read().decode("utf-8", errors="replace")
    
    reader = csv.DictReader(io.StringIO(content), delimiter=";")
    result = {}
    for row in reader:
        code = row.get("INSEE_C", "").strip().strip('"')
        if not code:
            continue
        name = row.get("LIBGEO", "").strip().strip('"')
        rent = parse_float(row.get("loypredm2"))
        typpred = row.get("TYPPRED", "").strip().strip('"')
        r2 = parse_float(row.get("R2_adj"))
        result[code] = {
            "name": name,
            "rent": rent,
            "is_commune": (typpred.lower() == "com"),
            "r2": r2,
        }
    return result

def main():
    target_dir = os.path.join(os.path.dirname(__file__), "..", "internal", "service", "realestate", "rentalseed")
    os.makedirs(target_dir, exist_ok=True)
    out_path = os.path.join(target_dir, "carte_loyers_2025.csv.gz")

    app_data = fetch_and_parse(DATASETS["app"])
    app12_data = fetch_and_parse(DATASETS["app12"])
    app3_data = fetch_and_parse(DATASETS["app3"])
    mai_data = fetch_and_parse(DATASETS["mai"])

    all_codes = sorted(set(list(app_data.keys()) + list(mai_data.keys())))
    print(f"Total distinct commune codes: {len(all_codes)}")

    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=",", lineterminator="\n")
    writer.writerow([
        "city_code",
        "city_name",
        "apartment_rent_per_m2",
        "apartment_t1_t2_rent_per_m2",
        "apartment_t3_plus_rent_per_m2",
        "house_rent_per_m2",
        "is_commune_level",
        "r2_adjusted",
    ])

    for code in all_codes:
        app = app_data.get(code, {})
        app12 = app12_data.get(code, {})
        app3 = app3_data.get(code, {})
        mai = mai_data.get(code, {})

        name = app.get("name") or mai.get("name") or code
        app_rent = app.get("rent", "")
        app12_rent = app12.get("rent", "")
        app3_rent = app3.get("rent", "")
        mai_rent = mai.get("rent", "")
        is_com = "true" if (app.get("is_commune") or mai.get("is_commune")) else "false"
        r2 = app.get("r2") or mai.get("r2") or ""

        writer.writerow([
            code,
            name,
            app_rent if app_rent is not None else "",
            app12_rent if app12_rent is not None else "",
            app3_rent if app3_rent is not None else "",
            mai_rent if mai_rent is not None else "",
            is_com,
            r2 if r2 is not None else "",
        ])

    csv_bytes = buf.getvalue().encode("utf-8")
    with gzip.open(out_path, "wb", compresslevel=9) as f:
        f.write(csv_bytes)

    size_kb = os.path.getsize(out_path) / 1024
    print(f"Written {out_path} ({size_kb:.1f} KB)")

if __name__ == "__main__":
    main()
