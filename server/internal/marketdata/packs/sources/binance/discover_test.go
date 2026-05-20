package binance

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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

func TestDiscoverUniverse(t *testing.T) {
	// Mock Binance APIs
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v3/exchangeInfo":
			resp := exchangeInfoResponse{
				Symbols: []exchangeInfoSymbol{
					{Symbol: "BTCUSDT", Status: "TRADING", BaseAsset: "BTC", QuoteAsset: "USDT"},
					{Symbol: "ETHUSDT", Status: "TRADING", BaseAsset: "ETH", QuoteAsset: "USDT"},
					{Symbol: "SOLUSDT", Status: "TRADING", BaseAsset: "SOL", QuoteAsset: "USDT"},
					{Symbol: "DOGEUSDT", Status: "TRADING", BaseAsset: "DOGE", QuoteAsset: "USDT"},
					// Leverage token - should be excluded
					{Symbol: "BTCUPUSDT", Status: "TRADING", BaseAsset: "BTCUP", QuoteAsset: "USDT"},
					// Status not TRADING
					{Symbol: "XRPUSDT", Status: "BREAK", BaseAsset: "XRP", QuoteAsset: "USDT"},
					// Non-USDT pair
					{Symbol: "BTCAUD", Status: "TRADING", BaseAsset: "BTC", QuoteAsset: "AUD"},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp)
		case "/api/v3/ticker/24hr":
			resp := []tickerEntry{
				{Symbol: "BTCUSDT", QuoteVolume: "1000000"},
				{Symbol: "ETHUSDT", QuoteVolume: "800000"},
				{Symbol: "SOLUSDT", QuoteVolume: "1200000"}, // highest volume
				{Symbol: "DOGEUSDT", QuoteVolume: "10000"},
				{Symbol: "BTCUPUSDT", QuoteVolume: "999999999"},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	src := NewSource(Config{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})

	// Discover top 3 symbols
	uni, err := src.DiscoverUniverse(context.Background(), 3)
	if err != nil {
		t.Fatalf("DiscoverUniverse failed: %v", err)
	}

	if len(uni.Symbols) != 3 {
		t.Fatalf("expected 3 symbols, got %d", len(uni.Symbols))
	}

	// Should be sorted by quote volume descending (excluding leverage token BTCUPUSDT):
	// 1st: SOLUSDT (1200000)
	// 2nd: BTCUSDT (1000000)
	// 3rd: ETHUSDT (800000)
	if uni.Symbols[0].Symbol != "SOLUSDT" {
		t.Errorf("expected 1st symbol to be SOLUSDT, got %s", uni.Symbols[0].Symbol)
	}
	if uni.Symbols[1].Symbol != "BTCUSDT" {
		t.Errorf("expected 2nd symbol to be BTCUSDT, got %s", uni.Symbols[1].Symbol)
	}
	if uni.Symbols[2].Symbol != "ETHUSDT" {
		t.Errorf("expected 3rd symbol to be ETHUSDT, got %s", uni.Symbols[2].Symbol)
	}

	// Instrument ID should be generated deterministically via UUIDv5
	expectedSolID := instrumentID("SOLUSDT")
	if uni.Symbols[0].InstrumentID != expectedSolID {
		t.Errorf("expected SOLUSDT InstrumentID to be %s, got %s", expectedSolID, uni.Symbols[0].InstrumentID)
	}
}

func TestDiscoverUniverse_Fallback(t *testing.T) {
	// Mock Binance API returning 451 legal block
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnavailableForLegalReasons)
	}))
	defer server.Close()

	src := NewSource(Config{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	})

	// Ask for 5 symbols, which should trigger loading 50-symbol fallback and slicing to 5
	uni, err := src.DiscoverUniverse(context.Background(), 5)
	if err != nil {
		t.Fatalf("DiscoverUniverse fallback failed: %v", err)
	}

	if len(uni.Symbols) != 5 {
		t.Fatalf("expected 5 symbols after fallback slice, got %d", len(uni.Symbols))
	}

	// Spot check the fallback universe contents (should match crypto-binance-core-50.yaml top symbols)
	if uni.Symbols[0].Symbol != "CHIPUSDT" {
		t.Errorf("expected 1st symbol to be CHIPUSDT, got %s", uni.Symbols[0].Symbol)
	}
	if uni.Symbols[1].Symbol != "BTCUSDT" {
		t.Errorf("expected 2nd symbol to be BTCUSDT, got %s", uni.Symbols[1].Symbol)
	}
}
