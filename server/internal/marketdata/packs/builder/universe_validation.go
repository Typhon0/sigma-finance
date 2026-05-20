package builder

import (
	"context"
	"fmt"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"sigma_finance/internal/marketdata/packs/sources"
	"sigma_finance/internal/marketdata/packs/sources/binance"
)

const defaultBinancePublicDataBaseURL = "https://data.binance.vision"

var (
	binanceSymbolPattern = regexp.MustCompile(`^[A-Z0-9]+USDT$`)
)

type BinanceUniverseValidationOptions struct {
	CheckAvailability bool
	BaseURL           string
	HTTPClient        *http.Client
}

func ValidateBinanceUniverse(ctx context.Context, universePath string, universe *sources.Universe, opts BinanceUniverseValidationOptions) error {
	if universePath == "" {
		return nil
	}
	if universe == nil {
		return fmt.Errorf("universe is required")
	}
	if err := validateUniverseCount(universePath, len(universe.Symbols)); err != nil {
		return err
	}

	byInstrumentID := make(map[string]string, len(universe.Symbols))
	byBaseAsset := make(map[string]string, len(universe.Symbols))
	bySymbol := make(map[string]struct{}, len(universe.Symbols))

	for i, row := range universe.Symbols {
		instrumentID := strings.TrimSpace(row.InstrumentID)
		symbol := strings.TrimSpace(strings.ToUpper(row.Symbol))
		baseAsset := strings.TrimSpace(strings.ToUpper(row.BaseAsset))
		quoteAsset := strings.TrimSpace(strings.ToUpper(row.QuoteAsset))

		if !binanceSymbolPattern.MatchString(symbol) {
			return fmt.Errorf("universe symbol %d has invalid Binance USDT format: %s", i, symbol)
		}
		if quoteAsset != "USDT" {
			return fmt.Errorf("universe symbol %s quote_asset must be USDT", symbol)
		}
		if binance.IsExcludedBaseAsset(baseAsset) {
			return fmt.Errorf("universe symbol %s excluded by policy (base_asset=%s)", symbol, baseAsset)
		}

		if first, exists := byInstrumentID[instrumentID]; exists {
			return fmt.Errorf("duplicate instrument_id %s for symbols %s and %s", instrumentID, first, symbol)
		}
		byInstrumentID[instrumentID] = symbol

		if _, exists := bySymbol[symbol]; exists {
			return fmt.Errorf("duplicate symbol %s", symbol)
		}
		bySymbol[symbol] = struct{}{}

		if first, exists := byBaseAsset[baseAsset]; exists {
			return fmt.Errorf("duplicate base_asset %s for symbols %s and %s", baseAsset, first, symbol)
		}
		byBaseAsset[baseAsset] = symbol
	}

	if !opts.CheckAvailability {
		return nil
	}

	baseURL := strings.TrimRight(strings.TrimSpace(opts.BaseURL), "/")
	if baseURL == "" {
		baseURL = defaultBinancePublicDataBaseURL
	}
	client := opts.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 8 * time.Second}
	}

	for _, row := range universe.Symbols {
		ok, err := hasBinancePublicData(ctx, client, baseURL, strings.TrimSpace(strings.ToUpper(row.Symbol)))
		if err != nil {
			return fmt.Errorf("availability check failed for %s: %w", row.Symbol, err)
		}
		if !ok {
			return fmt.Errorf("missing Binance public-data archive for %s", row.Symbol)
		}
	}

	return nil
}

func validateUniverseCount(universePath string, count int) error {
	expected := 0
	switch filepath.Base(universePath) {
	case "crypto-binance-core-50.yaml":
		expected = 50
	case "crypto-binance-core-100.yaml", "crypto-binance-core.yaml":
		expected = 100
	case "crypto-binance-core-250.yaml":
		expected = 250
	}
	if expected > 0 && count != expected {
		return fmt.Errorf("universe count mismatch for %s: got %d expected %d", filepath.Base(universePath), count, expected)
	}
	return nil
}

func hasBinancePublicData(ctx context.Context, client *http.Client, baseURL string, symbol string) (bool, error) {
	now := time.Now().UTC()
	for i := 0; i < 24; i++ {
		month := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, -i, 0)
		ym := month.Format("2006-01")
		url := fmt.Sprintf("%s/data/spot/monthly/klines/%s/1d/%s-1d-%s.zip", baseURL, symbol, symbol, ym)
		req, err := http.NewRequestWithContext(ctx, http.MethodHead, url, nil)
		if err != nil {
			return false, err
		}
		resp, err := client.Do(req)
		if err != nil {
			return false, err
		}
		resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			return true, nil
		}
		if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusForbidden {
			continue
		}
		return false, fmt.Errorf("status %d for %s", resp.StatusCode, url)
	}
	return false, nil
}


