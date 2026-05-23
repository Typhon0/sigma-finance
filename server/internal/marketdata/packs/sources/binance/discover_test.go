package binance

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestInstrumentIDDeterminism(t *testing.T) {
	id1 := instrumentID("BTCUSDT")
	id2 := instrumentID("BTCUSDT")
	if id1 != id2 {
		t.Errorf("instrumentID not deterministic: got %q and %q", id1, id2)
	}

	id3 := instrumentID("ETHUSDT")
	if id1 == id3 {
		t.Errorf("instrumentID collision for different symbols: %q", id1)
	}

	// UUIDv5 format verification (8-4-4-4-12)
	if len(id1) != 36 {
		t.Fatalf("expected length 36, got %d", len(id1))
	}
	if id1[8] != '-' || id1[13] != '-' || id1[18] != '-' || id1[23] != '-' {
		t.Errorf("invalid UUID format: %s", id1)
	}
}

// mockCMCServer returns a test server that serves a CMC listings/latest response.
// The serveArchives flag controls whether HEAD requests to archive URLs return 200.
func mockCMCServer(t *testing.T, coins []string, serveArchives bool) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/v1/cryptocurrency/listings/latest") {
			type entry struct {
				Symbol string `json:"symbol"`
			}
			type resp struct {
				Data []entry `json:"data"`
			}
			data := make([]entry, len(coins))
			for i, c := range coins {
				data[i] = entry{Symbol: c}
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp{Data: data})
			return
		}
		// Archive probe HEAD requests
		if r.Method == http.MethodHead {
			if serveArchives {
				w.WriteHeader(http.StatusOK)
			} else {
				w.WriteHeader(http.StatusNotFound)
			}
			return
		}
		http.NotFound(w, r)
	}))
}

func TestDiscoverUniverse_CMC(t *testing.T) {
	// Local mode: no archive probing, trust CMC order directly.
	server := mockCMCServer(t, []string{"BTC", "ETH", "SOL", "DOGE", "USDT" /* excluded */}, true)
	defer server.Close()

	src := NewSource(Config{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})

	uni, err := src.DiscoverUniverse(context.Background(), 3)
	if err != nil {
		t.Fatalf("DiscoverUniverse failed: %v", err)
	}
	if len(uni.Symbols) != 3 {
		t.Fatalf("expected 3 symbols, got %d", len(uni.Symbols))
	}

	// CMC order: BTC, ETH, SOL (USDT excluded)
	want := []string{"BTCUSDT", "ETHUSDT", "SOLUSDT"}
	for i, sym := range uni.Symbols {
		if sym.Symbol != want[i] {
			t.Errorf("symbol[%d]: want %s got %s", i, want[i], sym.Symbol)
		}
		if sym.QuoteAsset != "USDT" {
			t.Errorf("symbol[%d]: expected QuoteAsset USDT, got %s", i, sym.QuoteAsset)
		}
		if sym.AssetType != "CRYPTO" {
			t.Errorf("symbol[%d]: expected AssetType CRYPTO, got %s", i, sym.AssetType)
		}
		expectedID := instrumentID(sym.Symbol)
		if sym.InstrumentID != expectedID {
			t.Errorf("symbol[%d] InstrumentID mismatch: want %s got %s", i, expectedID, sym.InstrumentID)
		}
	}
}

func TestDiscoverUniverse_APIKeyHeader(t *testing.T) {
	var receivedKey string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/v1/cryptocurrency/listings/latest") {
			receivedKey = r.Header.Get("X-CMC_PRO_API_KEY")
			type entry struct {
				Symbol string `json:"symbol"`
			}
			type resp struct {
				Data []entry `json:"data"`
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp{Data: []entry{{Symbol: "BTC"}, {Symbol: "ETH"}}})
			return
		}
		w.WriteHeader(http.StatusOK) // archive probes always pass
	}))
	defer server.Close()

	src := NewSource(Config{
		BaseURL:             server.URL,
		HTTPClient:          server.Client(),
		CoinMarketCapAPIKey: "test-api-key-123",
	})

	_, err := src.DiscoverUniverse(context.Background(), 2)
	if err != nil {
		t.Fatalf("DiscoverUniverse failed: %v", err)
	}
	if receivedKey != "test-api-key-123" {
		t.Errorf("expected X-CMC_PRO_API_KEY=test-api-key-123, got %q", receivedKey)
	}
}

func TestDiscoverUniverse_CMCError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	src := NewSource(Config{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})

	_, err := src.DiscoverUniverse(context.Background(), 5)
	if err == nil {
		t.Fatal("expected error on CMC HTTP 401, got nil")
	}
	if !strings.Contains(err.Error(), "CMC API returned HTTP 401") {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestDiscoverUniverse_StrictCount(t *testing.T) {
	// Local mode with only 2 candidates but requesting 5 → must error.
	server := mockCMCServer(t, []string{"BTC", "ETH"}, true)
	defer server.Close()

	src := NewSource(Config{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})

	_, err := src.DiscoverUniverse(context.Background(), 5)
	if err == nil {
		t.Fatal("expected error when verified count < requested count, got nil")
	}
	if !strings.Contains(err.Error(), "CMC discovery found only") {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestDiscoverUniverse_ExcludesStablecoins(t *testing.T) {
	// Mix of real coins and excluded assets.
	coins := []string{"BTC", "ETH", "USDT", "USDC", "SOL", "BUSD", "WBTC"}
	server := mockCMCServer(t, coins, true)
	defer server.Close()

	src := NewSource(Config{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})

	uni, err := src.DiscoverUniverse(context.Background(), 3)
	if err != nil {
		t.Fatalf("DiscoverUniverse failed: %v", err)
	}
	for _, sym := range uni.Symbols {
		if sym.Symbol == "USDTUSDT" || sym.Symbol == "USDCUSDT" || sym.Symbol == "BUSDUSDT" || sym.Symbol == "WBTCUSDT" {
			t.Errorf("excluded asset appeared in results: %s", sym.Symbol)
		}
	}
}
