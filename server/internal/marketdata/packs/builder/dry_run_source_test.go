package builder

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"sigma_finance/internal/marketdata/packs/sources"
)

func TestRunSourceDryRunUsesFirstTwoSymbolsByDefault(t *testing.T) {
	btcZip := zipCSV(t, "btc.csv", "1704067200000,42000,43000,41000,42500,100,1704153599999,0,0,0,0,0\n")
	ethZip := zipCSV(t, "eth.csv", "1704067200000,2200,2300,2100,2250,200,1704153599999,0,0,0,0,0\n")
	bnbZip := zipCSV(t, "bnb.csv", "1704067200000,300,310,290,305,400,1704153599999,0,0,0,0,0\n")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, ".CHECKSUM") {
			target := strings.TrimSuffix(r.URL.Path, ".CHECKSUM")
			var payload []byte
			switch target {
			case "/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2024-01.zip":
				payload = btcZip
			case "/data/spot/monthly/klines/ETHUSDT/1d/ETHUSDT-1d-2024-01.zip":
				payload = ethZip
			case "/data/spot/monthly/klines/BNBUSDT/1d/BNBUSDT-1d-2024-01.zip":
				payload = bnbZip
			default:
				http.NotFound(w, r)
				return
			}
			sum := sha256.Sum256(payload)
			_, _ = w.Write([]byte(hex.EncodeToString(sum[:]) + "  file.zip\n"))
			return
		}

		switch r.URL.Path {
		case "/data/spot/monthly/klines/BTCUSDT/1d/BTCUSDT-1d-2024-01.zip":
			_, _ = w.Write(btcZip)
		case "/data/spot/monthly/klines/ETHUSDT/1d/ETHUSDT-1d-2024-01.zip":
			_, _ = w.Write(ethZip)
		case "/data/spot/monthly/klines/BNBUSDT/1d/BNBUSDT-1d-2024-01.zip":
			_, _ = w.Write(bnbZip)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	plan := &BuildPlan{
		Spec: &PackSpec{
			PackID:         "test-pack",
			SourceProvider: "binance-public-data",
			AssetType:      "CRYPTO",
			QuoteCurrency:  "USDT",
			History: HistorySpec{
				Start: "2024-01-01",
				End:   "2024-01-31",
			},
		},
		Universe: &sources.Universe{
			Symbols: []sources.UniverseSymbol{
				{InstrumentID: "i1", Symbol: "BTCUSDT", QuoteAsset: "USDT", AssetType: "CRYPTO"},
				{InstrumentID: "i2", Symbol: "ETHUSDT", QuoteAsset: "USDT", AssetType: "CRYPTO"},
				{InstrumentID: "i3", Symbol: "BNBUSDT", QuoteAsset: "USDT", AssetType: "CRYPTO"},
			},
		},
	}

	summary, err := RunSourceDryRun(context.Background(), plan, DryRunSourceOptions{
		SourceBaseURL: server.URL,
	})
	if err != nil {
		t.Fatalf("run source dry run: %v", err)
	}
	if summary.RowsCount != 2 {
		t.Fatalf("expected 2 rows for first two symbols, got %d", summary.RowsCount)
	}
	if len(summary.Symbols) != 2 {
		t.Fatalf("expected 2 symbols, got %d", len(summary.Symbols))
	}
	if summary.Symbols[0].First.IsZero() || summary.Symbols[0].Last.IsZero() {
		t.Fatalf("expected first/last timestamps")
	}
	if summary.Symbols[0].First.UTC().Format("2006-01-02") != "2024-01-01" {
		t.Fatalf("unexpected first date %s", summary.Symbols[0].First.UTC().Format(time.DateOnly))
	}
}

func zipCSV(t *testing.T, name string, content string) []byte {
	t.Helper()
	var buf bytes.Buffer
	archive := zip.NewWriter(&buf)
	file, err := archive.Create(name)
	if err != nil {
		t.Fatalf("create zip file: %v", err)
	}
	if _, err := file.Write([]byte(content)); err != nil {
		t.Fatalf("write zip content: %v", err)
	}
	if err := archive.Close(); err != nil {
		t.Fatalf("close zip archive: %v", err)
	}
	return buf.Bytes()
}
