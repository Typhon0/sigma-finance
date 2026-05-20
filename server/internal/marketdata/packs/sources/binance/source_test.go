package binance

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"sigma_finance/internal/marketdata/packs/sources"
)

func TestFetchCandlesParsesMillisecondsTimestamp(t *testing.T) {
	archive := loadZipFromCSVFixture(t, "kline-ms.csv")
	server := newFixtureServer(t, map[string]fixtureResponse{
		"/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2024-01.zip": {
			StatusCode:   http.StatusOK,
			Body:         archive,
			WithChecksum: true,
		},
	})
	defer server.Close()

	src := NewSource(Config{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})
	candles, err := collect(src.FetchCandles(context.Background(), sources.FetchCandlesRequest{
		PackSpec: sources.PackSpec{
			AssetType:     "CRYPTO",
			QuoteCurrency: "USDT",
		},
		Symbols: []sources.UniverseSymbol{
			{
				InstrumentID: "00000000-0000-0000-0000-000000000001",
				Symbol:       "BTCUSDT",
				QuoteAsset:   "USDT",
				AssetType:    "CRYPTO",
			},
		},
		StartDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2024, 1, 31, 0, 0, 0, 0, time.UTC),
	}))
	if err != nil {
		t.Fatalf("fetch candles: %v", err)
	}
	if len(candles) != 1 {
		t.Fatalf("expected 1 candle, got %d", len(candles))
	}
	if got, want := candles[0].Timestamp, time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC); !got.Equal(want) {
		t.Fatalf("unexpected timestamp got=%s want=%s", got, want)
	}
}

func TestFetchCandlesParsesMicrosecondsTimestamp(t *testing.T) {
	archive := loadZipFromCSVFixture(t, "kline-us.csv")
	server := newFixtureServer(t, map[string]fixtureResponse{
		"/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2025-01.zip": {
			StatusCode:   http.StatusOK,
			Body:         archive,
			WithChecksum: true,
		},
	})
	defer server.Close()

	src := NewSource(Config{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})
	candles, err := collect(src.FetchCandles(context.Background(), sources.FetchCandlesRequest{
		PackSpec: sources.PackSpec{
			AssetType:     "CRYPTO",
			QuoteCurrency: "USDT",
		},
		Symbols: []sources.UniverseSymbol{
			{
				InstrumentID: "00000000-0000-0000-0000-000000000001",
				Symbol:       "BTCUSDT",
				QuoteAsset:   "USDT",
				AssetType:    "CRYPTO",
			},
		},
		StartDate: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2025, 1, 31, 0, 0, 0, 0, time.UTC),
	}))
	if err != nil {
		t.Fatalf("fetch candles: %v", err)
	}
	if len(candles) != 1 {
		t.Fatalf("expected 1 candle, got %d", len(candles))
	}
	if got, want := candles[0].Timestamp, time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC); !got.Equal(want) {
		t.Fatalf("unexpected timestamp got=%s want=%s", got, want)
	}
}

func TestFetchCandlesBadOHLCRejected(t *testing.T) {
	archive := loadZipFromCSVFixture(t, "kline-bad-ohlc.csv")
	server := newFixtureServer(t, map[string]fixtureResponse{
		"/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2024-01.zip": {
			StatusCode: http.StatusOK,
			Body:       archive,
		},
	})
	defer server.Close()

	src := NewSource(Config{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})
	_, err := collect(src.FetchCandles(context.Background(), sources.FetchCandlesRequest{
		PackSpec: sources.PackSpec{
			AssetType:     "CRYPTO",
			QuoteCurrency: "USDT",
		},
		Symbols: []sources.UniverseSymbol{
			{
				InstrumentID: "00000000-0000-0000-0000-000000000001",
				Symbol:       "BTCUSDT",
				QuoteAsset:   "USDT",
				AssetType:    "CRYPTO",
			},
		},
		StartDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2024, 1, 31, 0, 0, 0, 0, time.UTC),
	}))
	if err == nil {
		t.Fatalf("expected bad OHLC error")
	}
}

func TestFetchCandlesDuplicateRejected(t *testing.T) {
	archive := loadZipFromCSVFixture(t, "kline-duplicate.csv")
	server := newFixtureServer(t, map[string]fixtureResponse{
		"/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2024-01.zip": {
			StatusCode: http.StatusOK,
			Body:       archive,
		},
	})
	defer server.Close()

	src := NewSource(Config{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})
	candles, err := collect(src.FetchCandles(context.Background(), sources.FetchCandlesRequest{
		PackSpec: sources.PackSpec{
			AssetType:     "CRYPTO",
			QuoteCurrency: "USDT",
		},
		Symbols: []sources.UniverseSymbol{
			{
				InstrumentID: "00000000-0000-0000-0000-000000000001",
				Symbol:       "BTCUSDT",
				QuoteAsset:   "USDT",
				AssetType:    "CRYPTO",
			},
		},
		StartDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2024, 1, 31, 0, 0, 0, 0, time.UTC),
	}))
	if err != nil {
		t.Fatalf("expected duplicate error to be skipped gracefully, but got error: %v", err)
	}
	if len(candles) != 1 {
		t.Fatalf("expected duplicate candle to be skipped (1 candle expected), got %d", len(candles))
	}
}

func TestFetchCandlesChecksumMismatchFails(t *testing.T) {
	archive := loadZipFromCSVFixture(t, "kline-ms.csv")
	server := newFixtureServer(t, map[string]fixtureResponse{
		"/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2024-01.zip": {
			StatusCode:   http.StatusOK,
			Body:         archive,
			WithChecksum: true,
			BadChecksum:  true,
		},
	})
	defer server.Close()

	src := NewSource(Config{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})
	_, err := collect(src.FetchCandles(context.Background(), sources.FetchCandlesRequest{
		PackSpec: sources.PackSpec{
			AssetType:     "CRYPTO",
			QuoteCurrency: "USDT",
		},
		Symbols: []sources.UniverseSymbol{
			{
				InstrumentID: "00000000-0000-0000-0000-000000000001",
				Symbol:       "BTCUSDT",
				QuoteAsset:   "USDT",
				AssetType:    "CRYPTO",
			},
		},
		StartDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2024, 1, 31, 0, 0, 0, 0, time.UTC),
	}))
	if err == nil || !strings.Contains(err.Error(), "checksum mismatch") {
		t.Fatalf("expected checksum mismatch error, got %v", err)
	}
}

func TestFetchCandlesMonthlyNotFoundFallsBackToDaily(t *testing.T) {
	archive := loadZipFromCSVFixture(t, "kline-ms.csv")
	server := newFixtureServer(t, map[string]fixtureResponse{
		"/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2024-01.zip": {
			StatusCode: http.StatusNotFound,
		},
		"/data/spot/daily/klines/BTCUSDT/1d/BTCUSDT-1d-2024-01-01.zip": {
			StatusCode: http.StatusOK,
			Body:       archive,
		},
	})
	defer server.Close()

	src := NewSource(Config{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})
	candles, err := collect(src.FetchCandles(context.Background(), sources.FetchCandlesRequest{
		PackSpec: sources.PackSpec{
			AssetType:     "CRYPTO",
			QuoteCurrency: "USDT",
		},
		Symbols: []sources.UniverseSymbol{
			{
				InstrumentID: "00000000-0000-0000-0000-000000000001",
				Symbol:       "BTCUSDT",
				QuoteAsset:   "USDT",
				AssetType:    "CRYPTO",
			},
		},
		StartDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}))
	if err != nil {
		t.Fatalf("fetch candles: %v", err)
	}
	if len(candles) != 1 {
		t.Fatalf("expected 1 candle from daily fallback, got %d", len(candles))
	}
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

type fixtureResponse struct {
	StatusCode   int
	Body         []byte
	WithChecksum bool
	BadChecksum  bool
}

func newFixtureServer(t *testing.T, fixtures map[string]fixtureResponse) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if strings.HasSuffix(path, ".CHECKSUM") {
			target := strings.TrimSuffix(path, ".CHECKSUM")
			fixture, ok := fixtures[target]
			if !ok || !fixture.WithChecksum {
				http.NotFound(w, r)
				return
			}
			sum := sha256.Sum256(fixture.Body)
			digest := hex.EncodeToString(sum[:])
			if fixture.BadChecksum {
				digest = strings.Repeat("a", 64)
			}
			_, _ = w.Write([]byte(digest + "  archive.zip\n"))
			return
		}
		fixture, ok := fixtures[path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		statusCode := fixture.StatusCode
		if statusCode == 0 {
			statusCode = http.StatusOK
		}
		w.WriteHeader(statusCode)
		if len(fixture.Body) > 0 {
			_, _ = w.Write(fixture.Body)
		}
	}))
}

func loadZipFromCSVFixture(t *testing.T, filename string) []byte {
	t.Helper()
	csvPath := filepath.Join("testdata", filename)
	content, err := os.ReadFile(csvPath)
	if err != nil {
		t.Fatalf("read fixture %s: %v", filename, err)
	}

	var buf bytes.Buffer
	writer := zip.NewWriter(&buf)
	fileWriter, err := writer.Create(strings.TrimSuffix(filename, filepath.Ext(filename)) + ".csv")
	if err != nil {
		t.Fatalf("create zip entry: %v", err)
	}
	if _, err := io.Copy(fileWriter, bytes.NewReader(content)); err != nil {
		t.Fatalf("write zip content: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close zip writer: %v", err)
	}
	return buf.Bytes()
}
