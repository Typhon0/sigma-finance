package service

import (
	"context"
	"fmt"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service/cache"
	"sigma_finance/internal/service/providers"
	"time"
)

// MarketDataService orchestrates provider selection, credential lookup and caching persistence.
type MarketDataService interface {
	GetCandles(ctx context.Context, userID int, symbol, assetType string, interval model.CandleInterval, from, to time.Time, limit int) ([]model.Candle, error)
	GetRealTimePrice(ctx context.Context, userID int, symbol, assetType string) (*model.Candle, error)
	ValidateProviderCredentials(ctx context.Context, userID int, providerID, apiKey string) error
	GetSupportedProviders(assetType string) []ProviderInfo
	GetProviderHealth(ctx context.Context) map[string]bool
}

// ProviderInfo contains information about a provider
type ProviderInfo struct {
	ID          string
	Name        string
	Type        string
	RequiresKey bool
	Intervals   []string
	RateLimit   providers.RateLimit
	SupportsRT  bool
}

type marketDataService struct {
	uow             repository.IUnitOfWork
	credRepo        repository.IMarketDataCredentialRepository
	providerManager providers.ProviderManager
	cache           cache.CandleCache
	security        SecurityService
	rateLimiter     RateLimiter
}

// NewMarketDataService creates a new enhanced market data service
func NewMarketDataService(
	uow repository.IUnitOfWork,
	candleRepo repository.ICandleRepository,
	credRepo repository.IMarketDataCredentialRepository,
	security SecurityService,
	rateLimiter RateLimiter,
) MarketDataService {
	// Create provider manager and register providers
	providerManager := providers.NewProviderManager()

	// Register crypto providers
	providerManager.RegisterProvider(providers.NewBinanceProvider())
	providerManager.RegisterProvider(providers.NewCryptoCompareProvider())

	// Register stock providers
	providerManager.RegisterProvider(providers.NewFinnhubProvider())
	providerManager.RegisterProvider(providers.NewTwelveDataProvider())

	// Create cache with 1000 entries and 5-minute staleness threshold
	candleCache := cache.NewCandleCache(candleRepo, 1000, 5*time.Minute)

	return &marketDataService{
		uow:             uow,
		credRepo:        credRepo,
		providerManager: providerManager,
		cache:           candleCache,
		security:        security,
		rateLimiter:     rateLimiter,
	}
}

func (s *marketDataService) GetCandles(ctx context.Context, userID int, symbol, assetType string, interval model.CandleInterval, from, to time.Time, limit int) ([]model.Candle, error) {
	// Check rate limiting
	if userID > 0 && s.rateLimiter != nil {
		if err := s.rateLimiter.CheckRateLimit(ctx, fmt.Sprintf("candles:user:%d", userID), 60, time.Minute); err != nil {
			return nil, fmt.Errorf("rate limit exceeded: %w", err)
		}
	}

	// Try cache first
	cached, missingRanges, err := s.cache.GetCachedRange(ctx, symbol, assetType, interval, from, to, limit)
	if err != nil {
		return nil, fmt.Errorf("cache error: %w", err)
	}

	// If we have complete data, return it
	if len(missingRanges) == 0 && len(cached) > 0 {
		return cached, nil
	}

	// Need to fetch missing data
	var allCandles []model.Candle
	allCandles = append(allCandles, cached...)

	for _, timeRange := range missingRanges {
		fetchedCandles, err := s.fetchCandlesFromProviders(ctx, userID, symbol, assetType, interval, timeRange.From, timeRange.To, limit)
		if err != nil {
			// Log error but continue with what we have
			continue
		}

		// Store in cache
		if len(fetchedCandles) > 0 {
			if err := s.cache.StoreCandlesInCache(ctx, fetchedCandles); err != nil {
				// Log error but continue
			}
			allCandles = append(allCandles, fetchedCandles...)
		}
	}

	// Sort and deduplicate
	allCandles = s.sortAndDeduplicateCandles(allCandles)

	// Apply limit
	if len(allCandles) > limit {
		allCandles = allCandles[:limit]
	}

	return allCandles, nil
}

func (s *marketDataService) GetRealTimePrice(ctx context.Context, userID int, symbol, assetType string) (*model.Candle, error) {
	// Get the most recent 1-minute candle
	to := time.Now()
	from := to.Add(-5 * time.Minute) // Last 5 minutes

	candles, err := s.GetCandles(ctx, userID, symbol, assetType, model.Interval1m, from, to, 1)
	if err != nil {
		return nil, err
	}

	if len(candles) == 0 {
		return nil, fmt.Errorf("no recent price data available")
	}

	return &candles[len(candles)-1], nil
}

func (s *marketDataService) ValidateProviderCredentials(ctx context.Context, userID int, providerID, apiKey string) error {
	provider, exists := s.providerManager.GetProvider(providerID)
	if !exists {
		return fmt.Errorf("unknown provider: %s", providerID)
	}

	return provider.ValidateCredentials(ctx, apiKey)
}

func (s *marketDataService) GetSupportedProviders(assetType string) []ProviderInfo {
	providers := s.providerManager.GetProvidersForAssetType(assetType)

	info := make([]ProviderInfo, 0, len(providers))
	for _, provider := range providers {
		caps := provider.Capabilities()

		intervals := make([]string, len(caps.Intervals))
		for i, interval := range caps.Intervals {
			intervals[i] = string(interval)
		}

		info = append(info, ProviderInfo{
			ID:          provider.ID(),
			Name:        provider.Name(),
			Type:        string(provider.Type()),
			RequiresKey: caps.RequiresAPIKey,
			Intervals:   intervals,
			RateLimit:   caps.RateLimit,
			SupportsRT:  caps.SupportsRealtime,
		})
	}

	return info
}

func (s *marketDataService) GetProviderHealth(ctx context.Context) map[string]bool {
	health := make(map[string]bool)

	// Check crypto providers
	cryptoProviders := s.providerManager.GetProvidersForAssetType("CRYPTO")
	for _, provider := range cryptoProviders {
		health[provider.ID()] = provider.IsHealthy(ctx)
	}

	// Check stock providers
	stockProviders := s.providerManager.GetProvidersForAssetType("STOCK")
	for _, provider := range stockProviders {
		health[provider.ID()] = provider.IsHealthy(ctx)
	}

	return health
}

// Private methods

func (s *marketDataService) fetchCandlesFromProviders(ctx context.Context, userID int, symbol, assetType string, interval model.CandleInterval, from, to time.Time, limit int) ([]model.Candle, error) {
	// Get user's API keys
	userCreds, err := s.credRepo.ListByUser(ctx, userID)
	if err != nil {
		userCreds = []model.MarketDataCredential{} // Continue without credentials
	}

	// Create credential map
	credMap := make(map[string]string)
	for _, cred := range userCreds {
		apiKey := cred.APIKey
		if s.security != nil && apiKey != "" {
			if decrypted, err := s.security.DecryptString(apiKey); err == nil {
				apiKey = decrypted
			}
		}
		credMap[cred.Provider] = apiKey
	}

	// Try providers in order of preference
	providerList := s.providerManager.GetProvidersForAssetType(assetType)

	for _, provider := range providerList {
		// Check if provider supports the interval
		caps := provider.Capabilities()
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

		// Get API key if required
		apiKey := ""
		if caps.RequiresAPIKey {
			var exists bool
			apiKey, exists = credMap[provider.ID()]
			if !exists || apiKey == "" {
				continue // Skip providers that require API key but don't have one
			}
		}

		// Check rate limiting for this provider
		if s.rateLimiter != nil {
			rateLimitKey := fmt.Sprintf("provider:%s:user:%d", provider.ID(), userID)
			if err := s.rateLimiter.CheckRateLimit(ctx, rateLimitKey, caps.RateLimit.RequestsPerMinute, time.Minute); err != nil {
				continue // Skip if rate limited
			}
		}

		// Attempt to fetch data
		req := providers.CandleRequest{
			Symbol:    symbol,
			AssetType: assetType,
			Interval:  interval,
			From:      from,
			To:        to,
			Limit:     limit,
			APIKey:    apiKey,
		}

		response, err := provider.GetCandles(ctx, req)
		if err != nil {
			// Log error and try next provider
			continue
		}

		if len(response.Candles) > 0 {
			return response.Candles, nil
		}
	}

	return nil, fmt.Errorf("no providers returned data for %s %s", assetType, symbol)
}

func (s *marketDataService) sortAndDeduplicateCandles(candles []model.Candle) []model.Candle {
	if len(candles) <= 1 {
		return candles
	}

	// Create map for deduplication
	candleMap := make(map[time.Time]model.Candle)
	for _, candle := range candles {
		// Keep the most recent source for each timestamp
		if existing, exists := candleMap[candle.Timestamp]; !exists || candle.Source < existing.Source {
			candleMap[candle.Timestamp] = candle
		}
	}

	// Convert back to slice
	result := make([]model.Candle, 0, len(candleMap))
	for _, candle := range candleMap {
		result = append(result, candle)
	}

	// Sort by timestamp
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[i].Timestamp.After(result[j].Timestamp) {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	return result
}
