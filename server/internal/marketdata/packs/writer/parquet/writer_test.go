package parquet

import (
	"context"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"sigma_finance/internal/marketdata/packs/sources"
	packservice "sigma_finance/internal/service/marketdata/packs"

	"github.com/parquet-go/parquet-go"
	"github.com/shopspring/decimal"
)

func TestBuildUnpackedDirectoryRoundTrip(t *testing.T) {
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
			AdjustedClose: nil,
			Volume:        mustDecimal(t, "123.45678901"),
			QuoteCurrency: "USDT",
			Source:        "binance-public-data",
		},
		{
			InstrumentID:  "00000000-0000-0000-0000-000000000001",
			Symbol:        "BTCUSDT",
			AssetType:     "CRYPTO",
			Interval:      "1d",
			Timestamp:     time.Date(2019, 1, 2, 0, 0, 0, 0, time.UTC),
			Open:          mustDecimal(t, "0.000024"),
			High:          mustDecimal(t, "0.000031"),
			Low:           mustDecimal(t, "0.000021"),
			Close:         mustDecimal(t, "0.000026"),
			AdjustedClose: nil,
			Volume:        mustDecimal(t, "124.45678901"),
			QuoteCurrency: "USDT",
			Source:        "binance-public-data",
		},
	}

	root := t.TempDir()
	result, err := BuildUnpackedDirectory(context.Background(), candles, BuildOptions{
		RootDir:     root,
		PartitionBy: []string{"asset_type", "quote_currency", "year"},
		Manifest: packservice.Manifest{
			PackID:         "crypto-binance-core-daily-usdt",
			Version:        "2026.05.01",
			Name:           "Crypto Binance Core Daily USDT",
			Description:    "Crypto Binance Core Daily USDT",
			FormatVersion:  1,
			Distribution:   "public",
			Interval:       "1d",
			SourceProvider: "binance-public-data",
			DataLicense:    "MIT",
			LicenseURL:     "https://example.test/license",
			GeneratedBy:    "sigma-finance pack-builder",
		},
	})
	if err != nil {
		t.Fatalf("build unpacked directory: %v", err)
	}

	expectedFile := filepath.Join(result.PackDir, "data", "asset_type=CRYPTO", "quote_currency=USDT", "year=2019", "part-000.parquet")
	rows, err := parquet.ReadFile[packCandleParquetRawRow](expectedFile)
	if err != nil {
		t.Fatalf("read parquet rows: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(rows))
	}
	if result.Manifest.RowsCount != 2 {
		t.Fatalf("expected rows_count=2, got %d", result.Manifest.RowsCount)
	}
	if result.Manifest.AssetsCount != 1 {
		t.Fatalf("expected assets_count=1, got %d", result.Manifest.AssetsCount)
	}
	if len(result.Manifest.Coverage) != 1 {
		t.Fatalf("expected 1 coverage row, got %d", len(result.Manifest.Coverage))
	}
	if len(result.Manifest.Files) != 1 {
		t.Fatalf("expected 1 file metadata row, got %d", len(result.Manifest.Files))
	}

	checksumsBody, err := os.ReadFile(filepath.Join(result.PackDir, "checksums.sha256"))
	if err != nil {
		t.Fatalf("read checksums file: %v", err)
	}
	if !strings.Contains(string(checksumsBody), "manifest.json") {
		t.Fatalf("expected checksums to include manifest.json")
	}
	if err := packservice.ValidatePackChecksums(result.PackDir, result.Manifest); err != nil {
		t.Fatalf("validate checksums: %v", err)
	}
}

// adjusted_close is optional but must survive the decimal fixed-length
// encoding. A nil-only fixture hid the tag/type mismatch that made the writer
// reject the column.
func TestBuildUnpackedDirectoryRoundTripsAdjustedClose(t *testing.T) {
	adjustedClose := mustDecimal(t, "123.456789012345678901")
	candles := []sources.NormalizedCandle{
		{
			InstrumentID:  "00000000-0000-0000-0000-000000000001",
			Symbol:        "AAPL",
			AssetType:     "STOCK",
			Interval:      "1d",
			Timestamp:     time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC),
			Open:          mustDecimal(t, "100"),
			High:          mustDecimal(t, "130"),
			Low:           mustDecimal(t, "99"),
			Close:         mustDecimal(t, "125"),
			AdjustedClose: &adjustedClose,
			Volume:        mustDecimal(t, "1000"),
			QuoteCurrency: "USD",
			Source:        "test",
		},
		{
			InstrumentID:  "00000000-0000-0000-0000-000000000001",
			Symbol:        "AAPL",
			AssetType:     "STOCK",
			Interval:      "1d",
			Timestamp:     time.Date(2024, 1, 3, 0, 0, 0, 0, time.UTC),
			Open:          mustDecimal(t, "101"),
			High:          mustDecimal(t, "131"),
			Low:           mustDecimal(t, "100"),
			Close:         mustDecimal(t, "126"),
			AdjustedClose: nil,
			Volume:        mustDecimal(t, "1001"),
			QuoteCurrency: "USD",
			Source:        "test",
		},
	}

	result, err := BuildUnpackedDirectory(context.Background(), candles, BuildOptions{
		RootDir:     t.TempDir(),
		PartitionBy: []string{"asset_type", "quote_currency", "year"},
		Manifest: packservice.Manifest{
			PackID:         "adjusted-close-pack",
			Version:        "1",
			Name:           "Adjusted Close Pack",
			Description:    "Adjusted Close Pack",
			FormatVersion:  1,
			Distribution:   "local",
			Interval:       "1d",
			SourceProvider: "test",
			DataLicense:    "MIT",
			LicenseURL:     "https://example.test/license",
			GeneratedBy:    "sigma-finance pack-builder",
		},
	})
	if err != nil {
		t.Fatalf("build unpacked directory: %v", err)
	}

	file := filepath.Join(result.PackDir, "data", "asset_type=STOCK", "quote_currency=USD", "year=2024", "part-000.parquet")
	rows, err := parquet.ReadFile[packCandleParquetRawRow](file)
	if err != nil {
		t.Fatalf("read parquet rows: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(rows))
	}
	if len(rows[0].AdjustedClose) != 16 {
		t.Fatalf("expected 16-byte adjusted close, got %d", len(rows[0].AdjustedClose))
	}
	if rows[1].AdjustedClose != nil {
		t.Fatalf("expected null adjusted close, got %x", rows[1].AdjustedClose)
	}
	decoded := decodeDecimalFixed(rows[0].AdjustedClose, 18)
	if !decoded.Equal(adjustedClose) {
		t.Fatalf("adjusted close round trip: expected %s got %s", adjustedClose, decoded)
	}
}

func TestEncodeDecimalFixedPreservesPrecision(t *testing.T) {
	value := mustDecimal(t, "0.000023")
	encoded, err := encodeDecimalFixed(value, 18, 38, 16)
	if err != nil {
		t.Fatalf("encode decimal fixed: %v", err)
	}
	decoded := decodeDecimalFixed(encoded[:], 18)
	if !decoded.Equal(value) {
		t.Fatalf("expected %s got %s", value, decoded)
	}
}

func TestEncodeDecimalFixedDoesNotDumpSliceHeader(t *testing.T) {
	// Values like 0.077 should encode to big-endian two's complement,
	// never dumping 64-bit slice pointer (0xc0...) or slice len 16 into bytes.
	value := mustDecimal(t, "0.077")
	encoded, err := encodeDecimalFixed(value, 18, 38, 16)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	// In 16-byte two's complement with scale 18:
	// 0.077 * 10^18 = 77000000000000000 = 0x01118f178fb48000
	// Bytes 0..7 must be 0x00, not a heap pointer (0xc0...)
	if encoded[0] != 0 || encoded[1] != 0 || encoded[2] != 0 || encoded[3] != 0 {
		t.Fatalf("expected high bytes 0, got %x", encoded[:4])
	}
	if encoded[4] == 0xc0 || encoded[5] == 0xc0 {
		t.Fatalf("detected heap pointer 0xc0 in encoded decimal: %x", encoded)
	}
	decoded := decodeDecimalFixed(encoded[:], 18)
	if !decoded.Equal(value) {
		t.Fatalf("expected %s got %s", value, decoded)
	}
}

func TestBuildUnpackedDirectoryDuplicateFails(t *testing.T) {
	value := mustDecimal(t, "1")
	candles := []sources.NormalizedCandle{
		{
			InstrumentID:  "00000000-0000-0000-0000-000000000001",
			Symbol:        "BTCUSDT",
			AssetType:     "CRYPTO",
			Interval:      "1d",
			Timestamp:     time.Date(2019, 1, 1, 0, 0, 0, 0, time.UTC),
			Open:          value,
			High:          value,
			Low:           value,
			Close:         value,
			Volume:        value,
			QuoteCurrency: "USDT",
			Source:        "a",
		},
		{
			InstrumentID:  "00000000-0000-0000-0000-000000000001",
			Symbol:        "BTCUSDT",
			AssetType:     "CRYPTO",
			Interval:      "1d",
			Timestamp:     time.Date(2019, 1, 1, 0, 0, 0, 0, time.UTC),
			Open:          value,
			High:          value,
			Low:           value,
			Close:         value,
			Volume:        value,
			QuoteCurrency: "USDT",
			Source:        "b",
		},
	}

	_, err := BuildUnpackedDirectory(context.Background(), candles, BuildOptions{
		RootDir:     t.TempDir(),
		PartitionBy: []string{"asset_type", "quote_currency", "year"},
		Manifest: packservice.Manifest{
			PackID:         "dup-pack",
			Version:        "1",
			Name:           "dup-pack",
			Description:    "dup-pack",
			FormatVersion:  1,
			Distribution:   "local",
			Interval:       "1d",
			SourceProvider: "binance-public-data",
			DataLicense:    "MIT",
			LicenseURL:     "https://example.test/license",
			GeneratedBy:    "sigma-finance pack-builder",
		},
	})
	if err == nil || !strings.Contains(err.Error(), "duplicate canonical candle key") {
		t.Fatalf("expected duplicate key error, got %v", err)
	}
}

func TestValidatePackChecksumsFailsWhenFileChanges(t *testing.T) {
	candles := []sources.NormalizedCandle{
		{
			InstrumentID:  "00000000-0000-0000-0000-000000000001",
			Symbol:        "BTCUSDT",
			AssetType:     "CRYPTO",
			Interval:      "1d",
			Timestamp:     time.Date(2019, 1, 1, 0, 0, 0, 0, time.UTC),
			Open:          mustDecimal(t, "1"),
			High:          mustDecimal(t, "2"),
			Low:           mustDecimal(t, "1"),
			Close:         mustDecimal(t, "2"),
			Volume:        mustDecimal(t, "10"),
			QuoteCurrency: "USDT",
			Source:        "binance-public-data",
		},
	}
	result, err := BuildUnpackedDirectory(context.Background(), candles, BuildOptions{
		RootDir:     t.TempDir(),
		PartitionBy: []string{"asset_type", "quote_currency", "year"},
		Manifest: packservice.Manifest{
			PackID:         "checksum-pack",
			Version:        "1",
			Name:           "checksum-pack",
			Description:    "checksum-pack",
			FormatVersion:  1,
			Distribution:   "local",
			Interval:       "1d",
			SourceProvider: "binance-public-data",
			DataLicense:    "MIT",
			LicenseURL:     "https://example.test/license",
			GeneratedBy:    "sigma-finance pack-builder",
		},
	})
	if err != nil {
		t.Fatalf("build unpacked directory: %v", err)
	}
	target := filepath.Join(result.PackDir, result.Manifest.Files[0].Path)
	if err := os.WriteFile(target, []byte("tampered"), 0o644); err != nil {
		t.Fatalf("tamper parquet file: %v", err)
	}
	if err := packservice.ValidatePackChecksums(result.PackDir, result.Manifest); err == nil {
		t.Fatalf("expected checksum validation failure")
	}
}

func mustDecimal(t *testing.T, raw string) decimal.Decimal {
	t.Helper()
	value, err := decimal.NewFromString(raw)
	if err != nil {
		t.Fatalf("parse decimal %s: %v", raw, err)
	}
	return value
}

func decodeDecimalFixed(raw []byte, scale int32) decimal.Decimal {
	if len(raw) == 0 {
		return decimal.Zero
	}
	i := new(big.Int).SetBytes(raw)
	if raw[0]&0x80 != 0 {
		max := new(big.Int).Lsh(big.NewInt(1), uint(len(raw))*8)
		i.Sub(i, max)
	}
	return decimal.NewFromBigInt(i, -scale)
}

type packCandleParquetRawRow struct {
	InstrumentID  string    `parquet:"instrument_id,uuid"`
	Symbol        string    `parquet:"symbol"`
	AssetType     string    `parquet:"asset_type"`
	Interval      string    `parquet:"interval"`
	Timestamp     time.Time `parquet:"timestamp,timestamp(microsecond)"`
	Open          []byte    `parquet:"open"`
	High          []byte    `parquet:"high"`
	Low           []byte    `parquet:"low"`
	Close         []byte    `parquet:"close"`
	AdjustedClose []byte    `parquet:"adjusted_close,optional"`
	Volume        []byte    `parquet:"volume"`
	QuoteCurrency string    `parquet:"quote_currency"`
	Source        string    `parquet:"source"`
}
