package packs

import (
	"math/big"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/marketdata/packs/sources"
	"sigma_finance/internal/service/providers"

	pq "github.com/parquet-go/parquet-go"
	"github.com/shopspring/decimal"
)

// The local pack writer used []byte fields with decimal tags. parquet-go
// serialises those as the Go slice header (pointer + length), so every price
// column was corrupted. The explicit schema plus fixed-size arrays is what
// keeps the bytes intact and adjusted_close nullable.
func TestLocalBuildWriterRoundTripsDecimals(t *testing.T) {
	adjusted := mustLocalDecimal(t, "123.456789012345678901")
	candles := []sources.NormalizedCandle{
		{
			InstrumentID:  "00000000-0000-0000-0000-000000000001",
			Symbol:        "AAPL",
			AssetType:     "STOCK",
			Interval:      "1d",
			Timestamp:     time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC),
			Open:          mustLocalDecimal(t, "100.1"),
			High:          mustLocalDecimal(t, "130.2"),
			Low:           mustLocalDecimal(t, "99.3"),
			Close:         mustLocalDecimal(t, "125.4"),
			AdjustedClose: &adjusted,
			Volume:        mustLocalDecimal(t, "1000.5"),
			QuoteCurrency: "USD",
			Source:        "test",
		},
		{
			InstrumentID:  "00000000-0000-0000-0000-000000000001",
			Symbol:        "AAPL",
			AssetType:     "STOCK",
			Interval:      "1d",
			Timestamp:     time.Date(2024, 1, 3, 0, 0, 0, 0, time.UTC),
			Open:          mustLocalDecimal(t, "101.1"),
			High:          mustLocalDecimal(t, "131.2"),
			Low:           mustLocalDecimal(t, "100.3"),
			Close:         mustLocalDecimal(t, "126.4"),
			AdjustedClose: nil,
			Volume:        mustLocalDecimal(t, "1001.5"),
			QuoteCurrency: "USD",
			Source:        "test",
		},
	}

	rows := make([]localBuildParquetRow, 0, len(candles))
	for _, candle := range candles {
		row, err := toLocalParquetRow(candle)
		if err != nil {
			t.Fatalf("to local parquet row: %v", err)
		}
		rows = append(rows, row)
	}

	path := filepath.Join(t.TempDir(), "part-000.parquet")
	if err := writeLocalParquetFile(path, rows); err != nil {
		t.Fatalf("write local parquet file: %v", err)
	}

	raw, err := pq.ReadFile[localBuildParquetRawRow](path)
	if err != nil {
		t.Fatalf("read local parquet file: %v", err)
	}
	if len(raw) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(raw))
	}
	if len(raw[0].Open) != 16 {
		t.Fatalf("expected 16-byte open, got %d", len(raw[0].Open))
	}
	if got := decodeLocalFixed(raw[0].Open, 18); !got.Equal(candles[0].Open) {
		t.Fatalf("open round trip: expected %s got %s", candles[0].Open, got)
	}
	if got := decodeLocalFixed(raw[0].AdjustedClose, 18); !got.Equal(adjusted) {
		t.Fatalf("adjusted close round trip: expected %s got %s", adjusted, got)
	}
	if raw[1].AdjustedClose != nil {
		t.Fatalf("expected null adjusted close, got %x", raw[1].AdjustedClose)
	}
}

type localBuildParquetRawRow struct {
	Open          []byte `parquet:"open"`
	High          []byte `parquet:"high"`
	Low           []byte `parquet:"low"`
	Close         []byte `parquet:"close"`
	AdjustedClose []byte `parquet:"adjusted_close,optional"`
	Volume        []byte `parquet:"volume"`
}

func mustLocalDecimal(t *testing.T, raw string) decimal.Decimal {
	t.Helper()
	value, err := decimal.NewFromString(raw)
	if err != nil {
		t.Fatalf("parse decimal %s: %v", raw, err)
	}
	return value
}

func decodeLocalFixed(raw []byte, scale int32) decimal.Decimal {
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

func TestResolveLocalBuildRateLimitsLowersProviderLimit(t *testing.T) {
	reqPerMinute := 50
	reqPerDay := 1000
	input := StartLocalPackBuildInput{
		RequestsPerMinute: &reqPerMinute,
		RequestsPerDay:    &reqPerDay,
	}
	limit := resolveLocalBuildRateLimits(input, providers.RateLimit{
		RequestsPerMinute: 200,
		RequestsPerDay:    10000,
	})
	if limit.RequestsPerMinute != 50 {
		t.Fatalf("expected 50 req/min, got %d", limit.RequestsPerMinute)
	}
	if limit.RequestsPerDay != 1000 {
		t.Fatalf("expected 1000 req/day, got %d", limit.RequestsPerDay)
	}
}

func TestBuildLocalPackIDDefault(t *testing.T) {
	id := buildLocalPackID("TIINGO", nil)
	if !strings.HasPrefix(id, "local-tiingo-daily-") {
		t.Fatalf("unexpected pack id %s", id)
	}
}

func TestResolveLocalBuildDatesDefaultRange(t *testing.T) {
	start, end := resolveLocalBuildDates(nil, nil, 10)
	if !end.After(start) {
		t.Fatalf("expected end after start")
	}
	years := end.Year() - start.Year()
	if years < 9 || years > 10 {
		t.Fatalf("expected ~10 year default history, got %d years", years)
	}
}

func TestResolveLocalBuildDatesExplicitOverride(t *testing.T) {
	startInput := time.Date(2020, 1, 2, 15, 0, 0, 0, time.UTC)
	endInput := time.Date(2021, 3, 4, 19, 0, 0, 0, time.UTC)
	start, end := resolveLocalBuildDates(&startInput, &endInput, 10)
	if start.Format(time.DateOnly) != "2020-01-02" {
		t.Fatalf("unexpected start date: %s", start.Format(time.DateOnly))
	}
	if end.Format(time.DateOnly) != "2021-03-04" {
		t.Fatalf("unexpected end date: %s", end.Format(time.DateOnly))
	}
}

func TestResolveMarketParquetSourceAliases(t *testing.T) {
	sourceMode := "local_folder"
	localPath := "/data/marketparquet"
	input := StartLocalPackBuildInput{
		SourceMode:              stringPtr("api_key"),
		ImportPath:              stringPtr("/ignored"),
		MarketParquetSourceMode: &sourceMode,
		MarketParquetLocalPath:  &localPath,
	}
	if got := resolveLocalBuildSourceMode(input); got != "local_folder" {
		t.Fatalf("expected marketparquet source mode alias to win, got %q", got)
	}
	if got := resolveLocalBuildImportPath(input); got != localPath {
		t.Fatalf("expected marketparquet local path alias to win, got %q", got)
	}
}

func TestValidateMarketParquetImportPathRequiresConfiguredRoot(t *testing.T) {
	root := t.TempDir()
	svc := &packService{cfg: Config{MarketParquetImportRoot: root}}
	inside := filepath.Join(root, "by_date")
	if err := svc.validateMarketParquetImportPath(inside); err != nil {
		t.Fatalf("expected path inside import root to pass, got %v", err)
	}
	outside := filepath.Join(t.TempDir(), "by_date")
	if err := svc.validateMarketParquetImportPath(outside); err == nil {
		t.Fatalf("expected path outside import root to fail")
	}
}

func TestLocalBuildRetryDelayBackoff(t *testing.T) {
	err := &providers.ProviderError{
		Provider:  "TIINGO",
		Code:      "RATE_LIMITED",
		Message:   "rate limit",
		HTTPCode:  429,
		Retryable: true,
	}
	one := localBuildRetryDelay(1, err)
	two := localBuildRetryDelay(2, err)
	three := localBuildRetryDelay(3, err)
	if one < time.Minute {
		t.Fatalf("expected attempt 1 delay >= 1m, got %s", one)
	}
	if two < 2*time.Minute {
		t.Fatalf("expected attempt 2 delay >= 2m, got %s", two)
	}
	if three < 4*time.Minute {
		t.Fatalf("expected attempt 3 delay >= 4m, got %s", three)
	}
}

func TestLocalBuildRetryDelayHonorsRetryAfter(t *testing.T) {
	err := &providers.ProviderError{
		Provider:          "TIINGO",
		Code:              "RATE_LIMITED",
		Message:           "rate limit",
		HTTPCode:          429,
		Retryable:         true,
		RetryAfterSeconds: 900,
	}
	wait := localBuildRetryDelay(1, err)
	if wait < 15*time.Minute {
		t.Fatalf("expected retry-after override to be honored, got %s", wait)
	}
}

func TestLocalBuildManifestFlags(t *testing.T) {
	svc := &packService{}
	job := &model.MarketDataPackBuildJob{
		PackID:         "local-tiingo-daily-test",
		SourceProvider: "TIINGO",
	}
	manifest := svc.localBuildManifest(job, localBuildConfig{AssetTypes: []string{"STOCK"}}, time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC), time.Date(2020, 1, 31, 0, 0, 0, 0, time.UTC))
	if manifest.Distribution != "local" {
		t.Fatalf("expected local distribution")
	}
	if manifest.InstallMode != "build_local" {
		t.Fatalf("expected build_local install mode")
	}
	if !manifest.GeneratedByUser {
		t.Fatalf("expected generated_by_user=true")
	}
	if !manifest.UploadForbidden {
		t.Fatalf("expected upload_forbidden=true")
	}
	if manifest.RedistributionAllowed {
		t.Fatalf("expected redistribution_allowed=false")
	}
}

func TestLocalBuildManifestMarksMarketParquetAdjustedPrices(t *testing.T) {
	svc := &packService{}
	job := &model.MarketDataPackBuildJob{
		PackID:         "local-marketparquet-daily-test",
		SourceProvider: "MARKETPARQUET",
	}
	manifest := svc.localBuildManifest(job, localBuildConfig{AssetTypes: []string{"STOCK", "FUND"}}, time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC), time.Date(2020, 1, 31, 0, 0, 0, 0, time.UTC))
	if manifest.PriceAdjustment != "split_dividend_adjusted" {
		t.Fatalf("expected split_dividend_adjusted marker, got %q", manifest.PriceAdjustment)
	}
	if manifest.RawUnadjustedAvailable {
		t.Fatalf("expected raw_unadjusted_available=false")
	}
}

func stringPtr(value string) *string {
	return &value
}
