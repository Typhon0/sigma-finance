package builder

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	licensegate "sigma_finance/internal/marketdata/packs/license"
	"sigma_finance/internal/marketdata/packs/sources"
)

func TestBuildUnpackedPackDefaultSymbolCapAndMaxSymbols(t *testing.T) {
	server := newBinanceFixtureServer(t)
	defer server.Close()

	plan := &BuildPlan{
		Spec: &PackSpec{
			PackID:         "test-pack",
			Name:           "Test Pack",
			Version:        "2026.05.01",
			FormatVersion:  1,
			Distribution:   "public",
			AssetType:      "CRYPTO",
			Interval:       "1d",
			QuoteCurrency:  "USDT",
			SourceProvider: "binance-public-data",
			History: HistorySpec{
				Start: "2024-01-01",
				End:   "2024-01-01",
			},
			Output: OutputConfig{
				Compression: "zstd",
				PartitionBy: []string{"asset_type", "quote_currency", "year"},
			},
		},
		Universe: &sources.Universe{
			Symbols: []sources.UniverseSymbol{
				{InstrumentID: "00000000-0000-0000-0000-000000000001", Symbol: "BTCUSDT", QuoteAsset: "USDT", AssetType: "CRYPTO"},
				{InstrumentID: "00000000-0000-0000-0000-000000000002", Symbol: "ETHUSDT", QuoteAsset: "USDT", AssetType: "CRYPTO"},
				{InstrumentID: "00000000-0000-0000-0000-000000000003", Symbol: "BNBUSDT", QuoteAsset: "USDT", AssetType: "CRYPTO"},
			},
		},
		LicensePolicy: &licensegate.Policy{
			ProviderID:            "binance-public-data",
			Name:                  "Binance Public Data",
			SourceURL:             "https://example.test/license",
			LicenseName:           "MIT",
			RedistributionAllowed: true,
			CommercialUseAllowed:  true,
			AttributionRequired:   true,
			TermsCheckedAt:        "2026-05-11",
		},
		OutputDir: t.TempDir(),
	}

	defaultResult, err := BuildUnpackedPack(context.Background(), plan, BuildUnpackedOptions{
		SourceBaseURL: server.URL,
	})
	if err != nil {
		t.Fatalf("build with default cap: %v", err)
	}
	if defaultResult.RowsCount != 2 {
		t.Fatalf("expected default cap rows=2, got %d", defaultResult.RowsCount)
	}

	maxOneResult, err := BuildUnpackedPack(context.Background(), plan, BuildUnpackedOptions{
		SourceBaseURL: server.URL,
		MaxSymbols:    1,
		MaxSymbolsSet: true,
	})
	if err != nil {
		t.Fatalf("build with max-symbols=1: %v", err)
	}
	if maxOneResult.RowsCount != 1 {
		t.Fatalf("expected max-symbols=1 rows=1, got %d", maxOneResult.RowsCount)
	}

	allResult, err := BuildUnpackedPack(context.Background(), plan, BuildUnpackedOptions{
		SourceBaseURL: server.URL,
		AllSymbols:    true,
	})
	if err != nil {
		t.Fatalf("build with all symbols: %v", err)
	}
	if allResult.RowsCount != 3 {
		t.Fatalf("expected all symbols rows=3, got %d", allResult.RowsCount)
	}

	if _, err := ValidateUnpackedPack(allResult.PackDir); err != nil {
		t.Fatalf("validate unpacked pack: %v", err)
	}

	tamperPath := filepath.Join(allResult.PackDir, allResult.Manifest.Files[0].Path)
	if err := os.WriteFile(tamperPath, []byte("tampered"), 0o644); err != nil {
		t.Fatalf("tamper pack parquet: %v", err)
	}
	if _, err := ValidateUnpackedPack(allResult.PackDir); err == nil {
		t.Fatalf("expected validation failure after tamper")
	}
}

func TestBuildUnpackedPacksMulti(t *testing.T) {
	server := newBinanceFixtureServer(t)
	defer server.Close()

	plan1 := &BuildPlan{
		Spec: &PackSpec{
			PackID:         "pack-50",
			Name:           "Top 50 Pack",
			Version:        "2026.05.01",
			FormatVersion:  1,
			Distribution:   "public",
			AssetType:      "CRYPTO",
			Interval:       "1d",
			QuoteCurrency:  "USDT",
			SourceProvider: "binance-public-data",
			History: HistorySpec{
				Start: "2024-01-01",
				End:   "2024-01-01",
			},
			Output: OutputConfig{
				Compression: "zstd",
				PartitionBy: []string{"asset_type", "quote_currency", "year"},
			},
		},
		Universe: &sources.Universe{
			Symbols: []sources.UniverseSymbol{
				{InstrumentID: "00000000-0000-0000-0000-000000000001", Symbol: "BTCUSDT", QuoteAsset: "USDT", AssetType: "CRYPTO"},
				{InstrumentID: "00000000-0000-0000-0000-000000000002", Symbol: "ETHUSDT", QuoteAsset: "USDT", AssetType: "CRYPTO"},
			},
		},
		LicensePolicy: &licensegate.Policy{
			ProviderID:            "binance-public-data",
			Name:                  "Binance Public Data",
			SourceURL:             "https://example.test/license",
			LicenseName:           "MIT",
			RedistributionAllowed: true,
			CommercialUseAllowed:  true,
			AttributionRequired:   true,
			TermsCheckedAt:        "2026-05-11",
		},
		OutputDir: filepath.Join(t.TempDir(), "pack-50"),
	}

	plan2 := &BuildPlan{
		Spec: &PackSpec{
			PackID:         "pack-100",
			Name:           "Top 100 Pack",
			Version:        "2026.05.01",
			FormatVersion:  1,
			Distribution:   "public",
			AssetType:      "CRYPTO",
			Interval:       "1d",
			QuoteCurrency:  "USDT",
			SourceProvider: "binance-public-data",
			History: HistorySpec{
				Start: "2024-01-01",
				End:   "2024-01-01",
			},
			Output: OutputConfig{
				Compression: "zstd",
				PartitionBy: []string{"asset_type", "quote_currency", "year"},
			},
		},
		Universe: &sources.Universe{
			Symbols: []sources.UniverseSymbol{
				{InstrumentID: "00000000-0000-0000-0000-000000000002", Symbol: "ETHUSDT", QuoteAsset: "USDT", AssetType: "CRYPTO"},
				{InstrumentID: "00000000-0000-0000-0000-000000000003", Symbol: "BNBUSDT", QuoteAsset: "USDT", AssetType: "CRYPTO"},
			},
		},
		LicensePolicy: &licensegate.Policy{
			ProviderID:            "binance-public-data",
			Name:                  "Binance Public Data",
			SourceURL:             "https://example.test/license",
			LicenseName:           "MIT",
			RedistributionAllowed: true,
			CommercialUseAllowed:  true,
			AttributionRequired:   true,
			TermsCheckedAt:        "2026-05-11",
		},
		OutputDir: filepath.Join(t.TempDir(), "pack-100"),
	}

	results, err := BuildUnpackedPacksMulti(context.Background(), []*BuildPlan{plan1, plan2}, BuildUnpackedOptions{
		SourceBaseURL: server.URL,
		AllSymbols:    true,
	})
	if err != nil {
		t.Fatalf("BuildUnpackedPacksMulti failed: %v", err)
	}

	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}

	// Verify plan1 result
	r1 := results[0]
	if r1.Manifest.PackID != "pack-50" {
		t.Errorf("expected pack-50, got %s", r1.Manifest.PackID)
	}
	if r1.AssetsCount != 2 {
		t.Errorf("expected 2 assets in pack-50, got %d", r1.AssetsCount)
	}

	// Verify plan2 result
	r2 := results[1]
	if r2.Manifest.PackID != "pack-100" {
		t.Errorf("expected pack-100, got %s", r2.Manifest.PackID)
	}
	if r2.AssetsCount != 2 {
		t.Errorf("expected 2 assets in pack-100, got %d", r2.AssetsCount)
	}
}

func newBinanceFixtureServer(t *testing.T) *httptest.Server {
	t.Helper()
	archives := map[string][]byte{
		"/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2024-01.zip": zipCSVFixture(t, "btc.csv", "1704067200000,42000,43000,41000,42500,100,1704153599999,0,0,0,0,0\n"),
		"/data/spot/monthly/klines/ETHUSDT/1d/ETHUSDT-1d-2024-01.zip": zipCSVFixture(t, "eth.csv", "1704067200000,2200,2300,2100,2250,200,1704153599999,0,0,0,0,0\n"),
		"/data/spot/monthly/klines/BNBUSDT/1d/BNBUSDT-1d-2024-01.zip": zipCSVFixture(t, "bnb.csv", "1704067200000,300,310,290,305,300,1704153599999,0,0,0,0,0\n"),
	}
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, ".CHECKSUM") {
			target := strings.TrimSuffix(r.URL.Path, ".CHECKSUM")
			body, ok := archives[target]
			if !ok {
				http.NotFound(w, r)
				return
			}
			sum := sha256.Sum256(body)
			_, _ = w.Write([]byte(hex.EncodeToString(sum[:]) + "  file.zip\n"))
			return
		}
		body, ok := archives[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write(body)
	}))
}

func zipCSVFixture(t *testing.T, name string, content string) []byte {
	t.Helper()
	var buf bytes.Buffer
	archive := zip.NewWriter(&buf)
	file, err := archive.Create(name)
	if err != nil {
		t.Fatalf("create zip entry: %v", err)
	}
	if _, err := file.Write([]byte(content)); err != nil {
		t.Fatalf("write zip entry: %v", err)
	}
	if err := archive.Close(); err != nil {
		t.Fatalf("close zip archive: %v", err)
	}
	return buf.Bytes()
}

