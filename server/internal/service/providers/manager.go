package providers

import (
	"errors"
	"sigma_finance/internal/domain/model"
	"sort"
	"strings"
	"sync"
)

// International stock exchange suffixes that Tiingo doesn't support well.
// Alpha Vantage should be preferred for these.
var internationalSuffixes = []string{
	".LON", // London Stock Exchange
	".DEX", // Germany XETRA
	".EPA", // Euronext Paris
	".MIL", // Milan
	".AMS", // Amsterdam
	".BRU", // Brussels
	".LIS", // Lisbon
	".TOR", // Toronto
	".TRT", // Toronto
	".BSE", // Bombay
	".NSE", // National Stock Exchange India
	".SHH", // Shanghai
	".SHZ", // Shenzhen
	".HKG", // Hong Kong
	".TSE", // Tokyo
	".KS",  // Korea Stock Exchange
	".KSC", // KOSDAQ
	".SAO", // B3 (Brazil)
	".MEX", // Mexico
	".TAI", // Taiwan
	".AAX", // ASX (Australia)
	".AX",  // ASX (Australia)
}

// isInternationalStock checks if a symbol likely belongs to an international market
// that Tiingo doesn't cover well.
func isInternationalStock(symbol string) bool {
	upper := strings.ToUpper(symbol)
	for _, suffix := range internationalSuffixes {
		if strings.HasSuffix(upper, suffix) {
			return true
		}
	}
	return false
}

// providerManager implements ProviderManager
type providerManager struct {
	providers     map[string]Provider
	rankings      map[string][]string          // assetType -> ordered provider IDs
	learnedRoutes map[string]map[string]string // assetType -> symbol -> providerID
	mu            sync.RWMutex
}

// NewProviderManager creates a new provider manager
func NewProviderManager() ProviderManager {
	return &providerManager{
		providers:     make(map[string]Provider),
		rankings:      make(map[string][]string),
		learnedRoutes: make(map[string]map[string]string),
	}
}

func (pm *providerManager) RegisterProvider(provider Provider) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	pm.providers[provider.ID()] = provider

	caps := provider.Capabilities()
	for _, assetType := range caps.AssetTypes {
		if pm.rankings[assetType] == nil {
			pm.rankings[assetType] = []string{}
		}

		priority := pm.getProviderPriority(provider.ID(), assetType)
		inserted := false

		for i, existingID := range pm.rankings[assetType] {
			existingPriority := pm.getProviderPriority(existingID, assetType)
			if priority < existingPriority {
				pm.rankings[assetType] = append(pm.rankings[assetType][:i],
					append([]string{provider.ID()}, pm.rankings[assetType][i:]...)...)
				inserted = true
				break
			}
		}

		if !inserted {
			pm.rankings[assetType] = append(pm.rankings[assetType], provider.ID())
		}
	}
}

func (pm *providerManager) GetProvider(id string) (Provider, bool) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	provider, exists := pm.providers[id]
	return provider, exists
}

func (pm *providerManager) GetProvidersForAssetType(assetType string) []Provider {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	providerIDs, exists := pm.rankings[assetType]
	if !exists {
		return []Provider{}
	}

	providers := make([]Provider, 0, len(providerIDs))
	for _, id := range providerIDs {
		if provider, exists := pm.providers[id]; exists {
			providers = append(providers, provider)
		}
	}

	return providers
}

func (pm *providerManager) GetAllProviders() []Provider {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	providers := make([]Provider, 0, len(pm.providers))
	for _, provider := range pm.providers {
		providers = append(providers, provider)
	}

	return providers
}

func (pm *providerManager) SelectBestProvider(assetType, symbol string, interval model.CandleInterval, requiresKey bool) (Provider, error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	// Check if we have a learned route for this symbol
	if learnedProviderID, ok := pm.learnedRoutes[assetType][symbol]; ok {
		if provider, exists := pm.providers[learnedProviderID]; exists {
			caps := provider.Capabilities()
			supportsInterval := false
			for _, supportedInterval := range caps.Intervals {
				if supportedInterval == interval {
					supportsInterval = true
					break
				}
			}
			if supportsInterval {
				// Check API key requirement
				if caps.RequiresAPIKey && !requiresKey {
					// No key available, skip learned route
				} else {
					return provider, nil
				}
			}
		}
	}

	// Intelligent routing based on symbol and asset type
	routedProviders := pm.getRoutedProviders(assetType, symbol)

	type scoredProvider struct {
		provider Provider
		score    int
	}

	scored := make([]scoredProvider, 0, len(routedProviders))

	for _, provider := range routedProviders {
		caps := provider.Capabilities()
		score := 0

		supportsInterval := false
		for _, supportedInterval := range caps.Intervals {
			if supportedInterval == interval {
				supportsInterval = true
				break
			}
		}
		if !supportsInterval {
			continue
		}

		// Prefer providers that don't require API key if none available
		if !requiresKey && !caps.RequiresAPIKey {
			score += 100
		} else if requiresKey && caps.RequiresAPIKey {
			score += 50
		}

		// Prefer providers with higher rate limits
		score += caps.RateLimit.RequestsPerMinute / 10

		// Prefer providers with realtime support
		if caps.SupportsRealtime {
			score += 25
		}

		// Add provider-specific priority
		score += pm.getProviderPriority(provider.ID(), assetType)

		scored = append(scored, scoredProvider{provider: provider, score: score})
	}

	if len(scored) == 0 {
		return nil, errors.New("no suitable providers found for " + assetType + " " + symbol)
	}

	sort.Slice(scored, func(i, j int) bool {
		return scored[i].score > scored[j].score
	})

	return scored[0].provider, nil
}

func (pm *providerManager) LearnProvider(symbol, assetType, providerID string) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if pm.learnedRoutes[assetType] == nil {
		pm.learnedRoutes[assetType] = make(map[string]string)
	}
	pm.learnedRoutes[assetType][symbol] = providerID
}

func (pm *providerManager) GetLearnedProvider(symbol, assetType string) (string, bool) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	if pm.learnedRoutes[assetType] == nil {
		return "", false
	}
	providerID, ok := pm.learnedRoutes[assetType][symbol]
	return providerID, ok
}

// getRoutedProviders returns providers ordered by intelligent routing rules.
//
// Routing Logic (per user spec):
//   - Is it AI/Technical Indicator request? -> Alpha Vantage (handled by TechnicalIndicatorRequest, not here)
//   - Is it Forex or International Stock? -> Alpha Vantage first
//   - Is it a US Stock or ETF? -> Tiingo first
//   - Otherwise -> follow default priority
func (pm *providerManager) getRoutedProviders(assetType, symbol string) []Provider {
	providerIDs, exists := pm.rankings[assetType]
	if !exists {
		return []Provider{}
	}

	// Forex: Alpha Vantage first (best forex coverage)
	if assetType == "FOREX" {
		return pm.reorderForForex(providerIDs)
	}

	// International stocks: Alpha Vantage first (Tiingo can't handle these)
	if assetType == "STOCK" || assetType == "ETF" || assetType == "FUND" {
		if isInternationalStock(symbol) {
			return pm.reorderForInternational(providerIDs)
		}
		// US stocks: Tiingo first (better rate limits, CRSP-adjusted data)
		return pm.reorderForUS(providerIDs)
	}

	// Default: use rankings as-is
	providers := make([]Provider, 0, len(providerIDs))
	for _, id := range providerIDs {
		if provider, ok := pm.providers[id]; ok {
			providers = append(providers, provider)
		}
	}
	return providers
}

// reorderForForex puts Alpha Vantage first for forex data.
func (pm *providerManager) reorderForForex(providerIDs []string) []Provider {
	var alphaVantageFirst []string
	others := []string{}

	for _, id := range providerIDs {
		if id == "ALPHAVANTAGE" || id == "ALPHA_VANTAGE" {
			alphaVantageFirst = append(alphaVantageFirst, id)
		} else {
			others = append(others, id)
		}
	}

	ordered := append(alphaVantageFirst, others...)
	providers := make([]Provider, 0, len(ordered))
	for _, id := range ordered {
		if provider, ok := pm.providers[id]; ok {
			providers = append(providers, provider)
		}
	}
	return providers
}

// reorderForInternational puts Alpha Vantage first for international stocks.
func (pm *providerManager) reorderForInternational(providerIDs []string) []Provider {
	var alphaVantageFirst []string
	others := []string{}

	for _, id := range providerIDs {
		if id == "ALPHAVANTAGE" || id == "ALPHA_VANTAGE" {
			alphaVantageFirst = append(alphaVantageFirst, id)
		} else {
			others = append(others, id)
		}
	}

	ordered := append(alphaVantageFirst, others...)
	providers := make([]Provider, 0, len(ordered))
	for _, id := range ordered {
		if provider, ok := pm.providers[id]; ok {
			providers = append(providers, provider)
		}
	}
	return providers
}

// reorderForUS puts Tiingo first for US equities.
func (pm *providerManager) reorderForUS(providerIDs []string) []Provider {
	var tiingoFirst []string
	var others []string

	for _, id := range providerIDs {
		if id == "TIINGO" {
			tiingoFirst = append(tiingoFirst, id)
		} else {
			others = append(others, id)
		}
	}

	ordered := append(tiingoFirst, others...)
	providers := make([]Provider, 0, len(ordered))
	for _, id := range ordered {
		if provider, ok := pm.providers[id]; ok {
			providers = append(providers, provider)
		}
	}
	return providers
}

// getProviderPriority returns priority score for provider (lower = higher priority)
//
// Routing strategy (per user spec):
//   - US Stock: TURINGO=1 (primary), ALPHA_VANTAGE=2 (fallback), TWELVEDATA=3, FINNHUB=4
//   - CRYPTO: BINANCE=1, CRYPTOCOMPARE=2
//   - FOREX: ALPHA_VANTAGE=1 (superior forex support), TIINGO=2
func (pm *providerManager) getProviderPriority(providerID, assetType string) int {
	switch assetType {
	case "STOCK", "ETF", "FUND":
		switch providerID {
		case "TIINGO":
			return 1 // Primary for US equities - 500 req/hr, CRSP-adjusted, IEX real-time
		case "ALPHAVANTAGE":
			return 2 // Fallback for US, primary for international stocks
		case "TWELVEDATA":
			return 3 // Good for chart data via Go backend
		case "FINNHUB":
			return 4 // WebSocket support, decent free tier
		case "YFINANCE":
			return 5 // Free fallback via Python sidecar, no API key needed
		default:
			return 50
		}
	case "CRYPTO":
		switch providerID {
		case "BINANCE":
			return 1 // Primary - real-time WebSocket streams, widest pair coverage
		case "CRYPTOCOMPARE":
			return 2 // Strong historical data, multiple exchange aggregation
		case "TIINGO":
			return 3 // Tiingo also supports crypto
		case "YFINANCE":
			return 4 // Free fallback via Python sidecar, no API key needed (e.g. BTC-USD)
		default:
			return 50
		}
	case "FOREX":
		switch providerID {
		case "ALPHAVANTAGE":
			return 1 // Best forex coverage
		case "TIINGO":
			return 2 // Tiingo also has forex
		case "TWELVEDATA":
			return 3
		default:
			return 50
		}
	default:
		return 100
	}
}
