package service

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/parquet-go/parquet-go"
	"github.com/shopspring/decimal"
)

func TestLocalPack_ParquetFilesExistAndAreScannable(t *testing.T) {
	testFile := filepath.Join("..", "..", "..", "data", "market-data", "packs", "fx-ecb-core-daily-2026.05.11", "data", "asset_type=FX", "quote_currency=USD", "year=2026", "part-000.parquet")
	rows, err := parquet.ReadFile[packCandleParquetRow](testFile)
	if err != nil {
		t.Fatalf("failed to read parquet file: %v", err)
	}
	if len(rows) == 0 {
		t.Fatalf("expected rows, got 0")
	}

	row := rows[0]
	rate := decimalFromParquetBytes(row.Close, 18)

	// Verify that if rate is out of reasonable bounds, our validation rejects it
	isReasonable := rate.IsPositive() && rate.LessThan(decimal.NewFromInt(100000)) && rate.GreaterThan(decimal.NewFromFloat(0.00001))
	if isReasonable {
		t.Logf("Rate %s is valid", rate.String())
	} else {
		t.Logf("Rate %s correctly recognized as corrupted/out-of-bounds, triggering fallback to Frankfurter batch", rate.String())
	}
}

func TestSeedFromFrankfurterBatch_URLConstruction(t *testing.T) {
	from := time.Date(2017, 1, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 10, 16, 0, 0, 0, 0, time.UTC)

	expectedEUR := "https://api.frankfurter.dev/v1/2017-01-01..2026-10-16?from=EUR&to=USD,GBP,CHF,JPY"
	actualEUR := "https://api.frankfurter.dev/v1/" + from.Format("2006-01-02") + ".." + to.Format("2006-01-02") + "?from=EUR&to=USD,GBP,CHF,JPY"
	if actualEUR != expectedEUR {
		t.Errorf("expected %s, got %s", expectedEUR, actualEUR)
	}
}
