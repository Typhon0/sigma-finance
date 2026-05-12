package builder

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"sigma_finance/internal/marketdata/packs/sources"
	parquetwriter "sigma_finance/internal/marketdata/packs/writer/parquet"
	sfpackwriter "sigma_finance/internal/marketdata/packs/writer/sfpack"
	packservice "sigma_finance/internal/service/marketdata/packs"

	"github.com/shopspring/decimal"
)

func TestValidatePackArchiveSuccess(t *testing.T) {
	packDir := buildValidationFixturePack(t)
	archive, err := sfpackwriter.CreateArchive(context.Background(), sfpackwriter.ArchiveOptions{
		PackDir: packDir,
		OutDir:  t.TempDir(),
	})
	if err != nil {
		t.Fatalf("create archive: %v", err)
	}
	summary, err := ValidatePack(archive.PackPath, ValidateOptions{
		ArchiveSHA256: archive.ArchiveSHA256,
	})
	if err != nil {
		t.Fatalf("validate archive: %v", err)
	}
	if summary.RowsCount != 1 {
		t.Fatalf("expected 1 row, got %d", summary.RowsCount)
	}
}

func TestValidatePackArchiveChecksumMismatchFails(t *testing.T) {
	packDir := buildValidationFixturePack(t)
	archive, err := sfpackwriter.CreateArchive(context.Background(), sfpackwriter.ArchiveOptions{
		PackDir: packDir,
		OutDir:  t.TempDir(),
	})
	if err != nil {
		t.Fatalf("create archive: %v", err)
	}
	if err := os.WriteFile(archive.PackPath, []byte("tampered"), 0o644); err != nil {
		t.Fatalf("tamper archive: %v", err)
	}
	if _, err := ValidatePack(archive.PackPath, ValidateOptions{
		ArchiveSHA256: archive.ArchiveSHA256,
	}); err == nil {
		t.Fatalf("expected checksum mismatch failure")
	}
}

func buildValidationFixturePack(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	candles := []sources.NormalizedCandle{
		{
			InstrumentID:  "00000000-0000-0000-0000-000000000001",
			Symbol:        "BTCUSDT",
			AssetType:     "CRYPTO",
			Interval:      "1d",
			Timestamp:     time.Date(2019, 1, 1, 0, 0, 0, 0, time.UTC),
			Open:          mustValidationDecimal(t, "0.000023"),
			High:          mustValidationDecimal(t, "0.000030"),
			Low:           mustValidationDecimal(t, "0.000020"),
			Close:         mustValidationDecimal(t, "0.000025"),
			Volume:        mustValidationDecimal(t, "123.45678901"),
			QuoteCurrency: "USDT",
			Source:        "binance-public-data",
		},
	}
	result, err := parquetwriter.BuildUnpackedDirectory(context.Background(), candles, parquetwriter.BuildOptions{
		RootDir:     root,
		PartitionBy: []string{"asset_type", "quote_currency", "year"},
		Manifest: packservice.Manifest{
			PackID:                "crypto-binance-core-daily-usdt",
			Version:               "2026.05.01",
			Name:                  "Crypto Binance Core Daily USDT",
			Description:           "Crypto Binance Core Daily USDT",
			FormatVersion:         1,
			Distribution:          "local",
			Interval:              "1d",
			AssetTypes:            []string{"CRYPTO"},
			QuoteCurrencies:       []string{"USDT"},
			SourceProvider:        "binance-public-data",
			DataLicense:           "MIT",
			RedistributionAllowed: true,
			CommercialUseAllowed:  true,
			AttributionRequired:   true,
			LicenseURL:            "https://example.test/license",
			GeneratedBy:           "sigma-finance pack-builder",
			GeneratedAt:           time.Date(2026, 5, 11, 0, 0, 0, 0, time.UTC),
			CreatedAt:             time.Date(2026, 5, 11, 0, 0, 0, 0, time.UTC),
			HistoryStart:          "2019-01-01",
			HistoryEnd:            "2019-01-01",
		},
	})
	if err != nil {
		t.Fatalf("build fixture pack: %v", err)
	}
	if _, err := os.Stat(filepath.Join(result.PackDir, "checksums.sha256")); err != nil {
		t.Fatalf("missing checksums: %v", err)
	}
	return result.PackDir
}

func mustValidationDecimal(t *testing.T, raw string) decimal.Decimal {
	t.Helper()
	value, err := decimal.NewFromString(raw)
	if err != nil {
		t.Fatalf("parse decimal %s: %v", raw, err)
	}
	return value
}
