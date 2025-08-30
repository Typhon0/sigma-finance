package providers

import (
	"errors"
	"sigma_finance/internal/domain/model"
	"sort"
)

// providerManager implements ProviderManager
type providerManager struct {
	providers map[string]Provider
	rankings  map[string][]string // assetType -> ordered provider IDs
}

// NewProviderManager creates a new provider manager
func NewProviderManager() ProviderManager {
	return &providerManager{
		providers: make(map[string]Provider),
		rankings:  make(map[string][]string),
	}
}

func (pm *providerManager) RegisterProvider(provider Provider) {
	pm.providers[provider.ID()] = provider

	// Update rankings for each supported asset type
	caps := provider.Capabilities()
	for _, assetType := range caps.AssetTypes {
		if pm.rankings[assetType] == nil {
			pm.rankings[assetType] = []string{}
		}

		// Insert provider in ranking based on priority
		priority := pm.getProviderPriority(provider.ID(), assetType)
		inserted := false

		for i, existingID := range pm.rankings[assetType] {
			existingPriority := pm.getProviderPriority(existingID, assetType)
			if priority < existingPriority {
				// Insert at position i
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
	provider, exists := pm.providers[id]
	return provider, exists
}

func (pm *providerManager) GetProvidersForAssetType(assetType string) []Provider {
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

func (pm *providerManager) SelectBestProvider(assetType, symbol string, interval model.CandleInterval, requiresKey bool) (Provider, error) {
	providers := pm.GetProvidersForAssetType(assetType)
	if len(providers) == 0 {
		return nil, errors.New("no providers available for asset type: " + assetType)
	}

	// Score providers based on criteria
	type scoredProvider struct {
		provider Provider
		score    int
	}

	scored := make([]scoredProvider, 0, len(providers))

	for _, provider := range providers {
		caps := provider.Capabilities()
		score := 0

		// Check if provider supports the interval
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
		return nil, errors.New("no suitable providers found")
	}

	// Sort by score (highest first)
	sort.Slice(scored, func(i, j int) bool {
		return scored[i].score > scored[j].score
	})

	return scored[0].provider, nil
}

// getProviderPriority returns priority score for provider (lower = higher priority)
func (pm *providerManager) getProviderPriority(providerID, assetType string) int {
	// Crypto provider priorities
	if assetType == "CRYPTO" {
		switch providerID {
		case "BINANCE":
			return 1 // Highest priority
		case "OKX":
			return 2
		case "KRAKEN":
			return 3
		case "COINBASE":
			return 4
		case "CRYPTOCOMPARE":
			return 5
		case "COINGECKO":
			return 10 // Lowest priority (daily only)
		default:
			return 50
		}
	}

	// Stock provider priorities
	if assetType == "STOCK" {
		switch providerID {
		case "FINNHUB":
			return 1 // Highest priority
		case "TWELVEDATA":
			return 2
		case "ALPHAVANTAGE":
			return 3
		case "IEX":
			return 4
		case "TIINGO":
			return 5
		case "STOOQ":
			return 10 // EOD only
		default:
			return 50
		}
	}

	return 100 // Default low priority
}
