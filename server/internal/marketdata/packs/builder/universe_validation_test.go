package builder

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"sigma_finance/internal/marketdata/packs/sources"
)

func TestValidateBinanceUniverseCount(t *testing.T) {
	t.Parallel()

	u := &sources.Universe{Symbols: make([]sources.UniverseSymbol, 99)}
	for i := range u.Symbols {
		u.Symbols[i] = sources.UniverseSymbol{
			InstrumentID: "00000000-0000-0000-0000-0000000000aa",
			Symbol:       "BTCUSDT",
			BaseAsset:    "BTC",
			QuoteAsset:   "USDT",
			AssetType:    "CRYPTO",
		}
	}
	err := ValidateBinanceUniverse(context.Background(), "/tmp/crypto-binance-core-100.yaml", u, BinanceUniverseValidationOptions{CheckAvailability: false})
	if err == nil || !strings.Contains(err.Error(), "count mismatch") {
		t.Fatalf("expected count mismatch, got %v", err)
	}
}

func TestValidateBinanceUniverseDuplicateChecks(t *testing.T) {
	t.Parallel()

	u := &sources.Universe{
		Symbols: []sources.UniverseSymbol{
			{
				InstrumentID: "11111111-1111-1111-1111-111111111111",
				Symbol:       "BTCUSDT",
				BaseAsset:    "BTC",
				QuoteAsset:   "USDT",
				AssetType:    "CRYPTO",
			},
			{
				InstrumentID: "11111111-1111-1111-1111-111111111111",
				Symbol:       "ETHUSDT",
				BaseAsset:    "ETH",
				QuoteAsset:   "USDT",
				AssetType:    "CRYPTO",
			},
		},
	}
	err := ValidateBinanceUniverse(context.Background(), "/tmp/anything.yaml", u, BinanceUniverseValidationOptions{CheckAvailability: false})
	if err == nil || !strings.Contains(err.Error(), "duplicate instrument_id") {
		t.Fatalf("expected duplicate instrument_id, got %v", err)
	}
}

func TestValidateBinanceUniverseSymbolFormat(t *testing.T) {
	t.Parallel()

	u := &sources.Universe{
		Symbols: []sources.UniverseSymbol{
			{
				InstrumentID: "11111111-1111-1111-1111-111111111111",
				Symbol:       "BTC-USD",
				BaseAsset:    "BTC",
				QuoteAsset:   "USDT",
				AssetType:    "CRYPTO",
			},
		},
	}
	err := ValidateBinanceUniverse(context.Background(), "/tmp/anything.yaml", u, BinanceUniverseValidationOptions{CheckAvailability: false})
	if err == nil || !strings.Contains(err.Error(), "invalid Binance USDT format") {
		t.Fatalf("expected format error, got %v", err)
	}
}

func TestValidateBinanceUniverseDefaultCoreCount(t *testing.T) {
	t.Parallel()

	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("get wd: %v", err)
	}
	universePath := filepath.Clean(filepath.Join(wd, "../../../../../packs/universes/crypto-binance-core.yaml"))
	u, err := sources.LoadUniverse(universePath)
	if err != nil {
		t.Fatalf("load universe: %v", err)
	}
	if err := ValidateBinanceUniverse(context.Background(), universePath, u, BinanceUniverseValidationOptions{CheckAvailability: false}); err != nil {
		t.Fatalf("validate default core universe: %v", err)
	}
	if got := len(u.Symbols); got != 100 {
		t.Fatalf("expected 100 symbols in default core universe, got %d", got)
	}
}
