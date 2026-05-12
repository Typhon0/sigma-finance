package sfpack

import (
	"context"
	"crypto/ed25519"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
	"time"

	"sigma_finance/internal/marketdata/packs/sources"
	parquetwriter "sigma_finance/internal/marketdata/packs/writer/parquet"
	packservice "sigma_finance/internal/service/marketdata/packs"

	"github.com/shopspring/decimal"
)

func TestCreateArchiveDeterministic(t *testing.T) {
	packDir := buildFixturePack(t, "local")
	outDir := t.TempDir()

	first, err := CreateArchive(context.Background(), ArchiveOptions{
		PackDir: packDir,
		OutDir:  outDir,
	})
	if err != nil {
		t.Fatalf("create first archive: %v", err)
	}
	second, err := CreateArchive(context.Background(), ArchiveOptions{
		PackDir:               packDir,
		OutDir:                outDir,
		ArchiveFilenameSuffix: "-second",
	})
	if err != nil {
		t.Fatalf("create second archive: %v", err)
	}

	if first.ArchiveSHA256 != second.ArchiveSHA256 {
		t.Fatalf("expected deterministic archive digest, got %s vs %s", first.ArchiveSHA256, second.ArchiveSHA256)
	}
}

func TestCreateArchivePublicUnsignedFailsByDefault(t *testing.T) {
	packDir := buildFixturePack(t, "public")
	_, err := CreateArchive(context.Background(), ArchiveOptions{
		PackDir: packDir,
		OutDir:  t.TempDir(),
	})
	if err == nil {
		t.Fatal("expected public unsigned archive failure")
	}
}

func TestCreateArchiveSignedAndVerify(t *testing.T) {
	packDir := buildFixturePack(t, "public")
	_, privateKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	privateHex := hex.EncodeToString(privateKey)

	result, err := CreateArchive(context.Background(), ArchiveOptions{
		PackDir:    packDir,
		OutDir:     t.TempDir(),
		SigningKey: privateHex,
	})
	if err != nil {
		t.Fatalf("create signed archive: %v", err)
	}
	if result.SignaturePath == "" {
		t.Fatalf("expected signature path")
	}

	meta, err := InspectArchive(result.PackPath)
	if err != nil {
		t.Fatalf("inspect archive: %v", err)
	}
	publicHex := hex.EncodeToString(privateKey.Public().(ed25519.PublicKey))
	if err := VerifySignature(publicHex, result.SignaturePath, meta.ArchiveSHA256, meta.ManifestSHA256, meta.ChecksumsSHA256); err != nil {
		t.Fatalf("verify signature: %v", err)
	}
	if err := VerifySignature(publicHex, result.SignaturePath, meta.ArchiveSHA256+"00", meta.ManifestSHA256, meta.ChecksumsSHA256); err == nil {
		t.Fatalf("expected signature failure for changed archive digest")
	}
}

func TestRegistryEntryIncludesArchiveDigestAlias(t *testing.T) {
	packDir := buildFixturePack(t, "local")
	result, err := CreateArchive(context.Background(), ArchiveOptions{
		PackDir: packDir,
		OutDir:  t.TempDir(),
	})
	if err != nil {
		t.Fatalf("create archive: %v", err)
	}
	meta, err := InspectArchive(result.PackPath)
	if err != nil {
		t.Fatalf("inspect archive: %v", err)
	}
	entry, err := BuildRegistryEntry(meta, "https://example.test/core.sfpack", "https://example.test/core.sfpack.sig")
	if err != nil {
		t.Fatalf("build registry entry: %v", err)
	}
	if entry.ArchiveSHA256 == "" || entry.Checksum == "" {
		t.Fatalf("expected archive checksum fields")
	}
	if entry.ArchiveSHA256 != entry.Checksum {
		t.Fatalf("expected checksum alias to archive digest")
	}
	if entry.InstallMode != "prebuilt" {
		t.Fatalf("expected install_mode prebuilt, got %s", entry.InstallMode)
	}
}

func buildFixturePack(t *testing.T, distribution string) string {
	t.Helper()
	root := t.TempDir()
	candles := []sources.NormalizedCandle{
		{
			InstrumentID:  "00000000-0000-0000-0000-000000000001",
			Symbol:        "BTCUSDT",
			AssetType:     "CRYPTO",
			Interval:      "1d",
			Timestamp:     time.Date(2019, 1, 1, 0, 0, 0, 0, time.UTC),
			Open:          mustDecimal(t, "0.000023"),
			High:          mustDecimal(t, "0.000030"),
			Low:           mustDecimal(t, "0.000020"),
			Close:         mustDecimal(t, "0.000025"),
			Volume:        mustDecimal(t, "123.45678901"),
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
			Distribution:          distribution,
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
	if _, err := os.Stat(filepath.Join(result.PackDir, "manifest.json")); err != nil {
		t.Fatalf("missing manifest: %v", err)
	}
	return result.PackDir
}

func mustDecimal(t *testing.T, raw string) decimal.Decimal {
	t.Helper()
	value, err := decimal.NewFromString(raw)
	if err != nil {
		t.Fatalf("parse decimal %s: %v", raw, err)
	}
	return value
}
