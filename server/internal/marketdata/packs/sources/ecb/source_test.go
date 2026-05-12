package ecb

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"sigma_finance/internal/marketdata/packs/sources"
)

func TestFetchCandlesBuildsRawInverseCrossPairs(t *testing.T) {
	body := mustFixture(t, "ecb_rates.csv")
	server := newECBFixtureServer(t, body)
	defer server.Close()

	src := NewSource(Config{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})
	candles, err := collect(src.FetchCandles(context.Background(), sources.FetchCandlesRequest{
		PackSpec: sources.PackSpec{
			AssetType:      "FX",
			SourceProvider: SourceName,
		},
		Symbols: []sources.UniverseSymbol{
			{InstrumentID: "00000000-0000-0000-0000-000000000001", Symbol: "EURUSD", BaseAsset: "EUR", QuoteAsset: "USD", AssetType: "FX"},
			{InstrumentID: "00000000-0000-0000-0000-000000000002", Symbol: "USDEUR", BaseAsset: "USD", QuoteAsset: "EUR", AssetType: "FX"},
			{InstrumentID: "00000000-0000-0000-0000-000000000003", Symbol: "USDGBP", BaseAsset: "USD", QuoteAsset: "GBP", AssetType: "FX"},
		},
		StartDate: time.Date(2026, 5, 9, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC),
	}))
	if err != nil {
		t.Fatalf("fetch candles: %v", err)
	}
	if len(candles) != 6 {
		t.Fatalf("expected 6 candles, got %d", len(candles))
	}

	raw := findCandle(t, candles, "EURUSD", "2026-05-09")
	if raw.Source != SourceName || raw.DerivationType != "raw" || len(raw.DerivedFrom) != 0 {
		t.Fatalf("unexpected raw metadata: %+v", raw)
	}

	inverse := findCandle(t, candles, "USDEUR", "2026-05-09")
	if inverse.Source != DerivedSourceName || inverse.DerivationType != "inverse" {
		t.Fatalf("unexpected inverse metadata: %+v", inverse)
	}
	if strings.Join(inverse.DerivedFrom, ",") != "EURUSD" {
		t.Fatalf("unexpected inverse derived_from: %v", inverse.DerivedFrom)
	}

	cross := findCandle(t, candles, "USDGBP", "2026-05-09")
	if cross.Source != DerivedSourceName || cross.DerivationType != "cross" {
		t.Fatalf("unexpected cross metadata: %+v", cross)
	}
	if strings.Join(cross.DerivedFrom, ",") != "EURUSD,EURGBP" {
		t.Fatalf("unexpected cross derived_from: %v", cross.DerivedFrom)
	}
	if cross.Volume.String() != "0" {
		t.Fatalf("expected zero volume for FX row, got %s", cross.Volume.String())
	}
}

func TestFetchCandlesPreservesDecimalPrecision(t *testing.T) {
	body := mustFixture(t, "ecb_rates.csv")
	server := newECBFixtureServer(t, body)
	defer server.Close()

	src := NewSource(Config{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})
	candles, err := collect(src.FetchCandles(context.Background(), sources.FetchCandlesRequest{
		PackSpec: sources.PackSpec{
			AssetType:      "FX",
			SourceProvider: SourceName,
		},
		Symbols: []sources.UniverseSymbol{
			{InstrumentID: "00000000-0000-0000-0000-000000000004", Symbol: "EURGBP", BaseAsset: "EUR", QuoteAsset: "GBP", AssetType: "FX"},
		},
		StartDate: time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC),
	}))
	if err != nil {
		t.Fatalf("fetch candles: %v", err)
	}
	if len(candles) != 1 {
		t.Fatalf("expected 1 candle, got %d", len(candles))
	}
	if candles[0].Close.String() != "0.8607" {
		t.Fatalf("unexpected precision loss, got %s", candles[0].Close.String())
	}
}

func TestFetchCandlesDuplicateKeyRejected(t *testing.T) {
	body := mustFixture(t, "ecb_rates.csv")
	server := newECBFixtureServer(t, body)
	defer server.Close()

	src := NewSource(Config{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})
	_, err := collect(src.FetchCandles(context.Background(), sources.FetchCandlesRequest{
		PackSpec: sources.PackSpec{
			AssetType:      "FX",
			SourceProvider: SourceName,
		},
		Symbols: []sources.UniverseSymbol{
			{InstrumentID: "00000000-0000-0000-0000-000000000001", Symbol: "EURUSD", BaseAsset: "EUR", QuoteAsset: "USD", AssetType: "FX"},
			{InstrumentID: "00000000-0000-0000-0000-000000000001", Symbol: "EURUSD", BaseAsset: "EUR", QuoteAsset: "USD", AssetType: "FX"},
		},
		StartDate: time.Date(2026, 5, 9, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2026, 5, 9, 0, 0, 0, 0, time.UTC),
	}))
	if err == nil || !strings.Contains(err.Error(), "duplicate candle key") {
		t.Fatalf("expected duplicate key error, got %v", err)
	}
}

func newECBFixtureServer(t *testing.T, body string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if !strings.Contains(r.URL.Path, "/service/data/EXR/") {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/csv")
		_, _ = w.Write([]byte(body))
	}))
}

func findCandle(t *testing.T, candles []sources.NormalizedCandle, symbol string, day string) sources.NormalizedCandle {
	t.Helper()
	for _, candle := range candles {
		if candle.Symbol == symbol && candle.Timestamp.UTC().Format(time.DateOnly) == day {
			return candle
		}
	}
	t.Fatalf("candle not found symbol=%s day=%s", symbol, day)
	return sources.NormalizedCandle{}
}

func collect(candlesCh <-chan sources.NormalizedCandle, errCh <-chan error) ([]sources.NormalizedCandle, error) {
	out := make([]sources.NormalizedCandle, 0, 64)
	for candlesCh != nil || errCh != nil {
		select {
		case candle, ok := <-candlesCh:
			if !ok {
				candlesCh = nil
				continue
			}
			out = append(out, candle)
		case err, ok := <-errCh:
			if !ok {
				errCh = nil
				continue
			}
			if err != nil {
				return nil, err
			}
		}
	}
	return out, nil
}

func mustFixture(t *testing.T, name string) string {
	t.Helper()
	path := filepath.Join("testdata", name)
	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read fixture %s: %v", name, err)
	}
	return string(body)
}

func TestFetchCandlesMissingCrossInputSkipsRow(t *testing.T) {
	body := "TIME_PERIOD,CURRENCY,CURRENCY_DENOM,OBS_VALUE\n2026-05-09,USD,EUR,1.1200\n"
	server := newECBFixtureServer(t, body)
	defer server.Close()

	src := NewSource(Config{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})
	candles, err := collect(src.FetchCandles(context.Background(), sources.FetchCandlesRequest{
		PackSpec: sources.PackSpec{
			AssetType:      "FX",
			SourceProvider: SourceName,
		},
		Symbols: []sources.UniverseSymbol{
			{InstrumentID: "00000000-0000-0000-0000-000000000003", Symbol: "USDGBP", BaseAsset: "USD", QuoteAsset: "GBP", AssetType: "FX"},
		},
		StartDate: time.Date(2026, 5, 9, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2026, 5, 9, 0, 0, 0, 0, time.UTC),
	}))
	if err != nil {
		t.Fatalf("fetch candles: %v", err)
	}
	if len(candles) != 0 {
		t.Fatalf("expected no cross rows when one input is missing, got %d", len(candles))
	}
}

func TestFetchCandlesRejectsInvalidCSV(t *testing.T) {
	body := "TIME_PERIOD,CURRENCY,CURRENCY_DENOM,OBS_VALUE\n2026-05-09,USD,EUR,not-a-number\n"
	server := newECBFixtureServer(t, body)
	defer server.Close()

	src := NewSource(Config{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})
	_, err := collect(src.FetchCandles(context.Background(), sources.FetchCandlesRequest{
		PackSpec: sources.PackSpec{
			AssetType:      "FX",
			SourceProvider: SourceName,
		},
		Symbols: []sources.UniverseSymbol{
			{InstrumentID: "00000000-0000-0000-0000-000000000001", Symbol: "EURUSD", BaseAsset: "EUR", QuoteAsset: "USD", AssetType: "FX"},
		},
		StartDate: time.Date(2026, 5, 9, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2026, 5, 9, 0, 0, 0, 0, time.UTC),
	}))
	if err == nil || !strings.Contains(err.Error(), "invalid OBS_VALUE") {
		t.Fatalf("expected invalid OBS_VALUE error, got %v", err)
	}
}

func TestFetchCandlesBuildsExpectedRequest(t *testing.T) {
	body := mustFixture(t, "ecb_rates.csv")
	var observedQuery string
	var observedPath string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		observedQuery = r.URL.RawQuery
		observedPath = r.URL.Path
		_, _ = w.Write([]byte(body))
	}))
	defer server.Close()

	src := NewSource(Config{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})
	_, err := collect(src.FetchCandles(context.Background(), sources.FetchCandlesRequest{
		PackSpec: sources.PackSpec{
			AssetType:      "FX",
			SourceProvider: SourceName,
		},
		Symbols: []sources.UniverseSymbol{
			{InstrumentID: "00000000-0000-0000-0000-000000000001", Symbol: "EURUSD", BaseAsset: "EUR", QuoteAsset: "USD", AssetType: "FX"},
			{InstrumentID: "00000000-0000-0000-0000-000000000002", Symbol: "USDEUR", BaseAsset: "USD", QuoteAsset: "EUR", AssetType: "FX"},
			{InstrumentID: "00000000-0000-0000-0000-000000000003", Symbol: "USDGBP", BaseAsset: "USD", QuoteAsset: "GBP", AssetType: "FX"},
		},
		StartDate: time.Date(2026, 5, 9, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC),
	}))
	if err != nil {
		t.Fatalf("fetch candles: %v", err)
	}
	expectedParts := []string{"startPeriod=2026-05-09", "endPeriod=2026-05-10", "format=csvdata"}
	for _, part := range expectedParts {
		if !strings.Contains(observedQuery, part) {
			t.Fatalf("query missing %q: %s", part, observedQuery)
		}
	}
	if !strings.Contains(observedPath, "USD") || !strings.Contains(observedPath, "GBP") {
		t.Fatalf("path missing expected currencies: %s", observedPath)
	}
}

func TestParsePairsFallbackFromSymbol(t *testing.T) {
	pairs, err := parsePairs(sources.PackSpec{AssetType: "FX"}, []sources.UniverseSymbol{
		{InstrumentID: "i1", Symbol: "USDJPY"},
	})
	if err != nil {
		t.Fatalf("parse pairs: %v", err)
	}
	if len(pairs) != 1 || pairs[0].Base != "USD" || pairs[0].Quote != "JPY" {
		t.Fatalf("unexpected pair parse result: %+v", pairs)
	}
}
