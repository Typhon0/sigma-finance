package service

import (
	"context"
	"fmt"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service/cache"
	"sigma_finance/internal/service/providers"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// MarketDataService orchestrates provider selection, credential lookup and caching persistence.
type MarketDataService interface {
	// Existing candle-based methods
	GetCandles(ctx context.Context, userID int, symbol, assetType string, interval model.CandleInterval, from, to time.Time, limit int) ([]model.Candle, error)
	GetRealTimePrice(ctx context.Context, userID int, symbol, assetType string) (*model.Candle, error)
	ValidateProviderCredentials(ctx context.Context, userID int, providerID, apiKey string) error
	GetSupportedProviders(assetType string) []ProviderInfo
	GetProviderHealth(ctx context.Context) map[string]bool

	// New asset price methods for task requirements
	GetCurrentAssetPrice(ctx context.Context, assetID uuid.UUID) (*AssetPriceData, error)
	GetCurrentAssetPrices(ctx context.Context, assetIDs []uuid.UUID) (map[uuid.UUID]*AssetPriceData, error)
	UpdateAssetPrices(ctx context.Context) error
	UpdateAssetPrice(ctx context.Context, assetID uuid.UUID) (*AssetPriceData, error)
	SchedulePriceUpdates(ctx context.Context, interval time.Duration) error
	StopPriceUpdates()
	ValidateAssetPriceData(ctx context.Context, price *model.AssetPrice) error
	GetStaleAssetPrices(ctx context.Context, maxAge time.Duration) ([]uuid.UUID, error)
	IsAssetPriceStale(ctx context.Context, assetID uuid.UUID, maxAge time.Duration) (bool, error)
	ClearAssetPriceCache()
	GetAssetPriceCacheStats() AssetPriceCacheStats
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

// AssetPriceData represents current price data for an asset
type AssetPriceData struct {
	AssetID          uuid.UUID        `json:"asset_id"`
	Price            decimal.Decimal  `json:"price"`
	Volume           *int64           `json:"volume,omitempty"`
	MarketCap        *int64           `json:"market_cap,omitempty"`
	Change24h        *decimal.Decimal `json:"change_24h,omitempty"`
	ChangePercent24h *decimal.Decimal `json:"change_percent_24h,omitempty"`
	Timestamp        time.Time        `json:"timestamp"`
	Source           string           `json:"source"`
	IsStale          bool             `json:"is_stale"`
}

// AssetPriceCacheEntry represents a cached price entry
type AssetPriceCacheEntry struct {
	Data      *AssetPriceData
	CachedAt  time.Time
	ExpiresAt time.Time
}

// AssetPriceCacheStats represents cache statistics
type AssetPriceCacheStats struct {
	TotalEntries int           `json:"total_entries"`
	HitRate      float64       `json:"hit_rate"`
	MissRate     float64       `json:"miss_rate"`
	AvgAge       time.Duration `json:"avg_age"`
}

// AssetPriceCache manages caching of asset prices
type AssetPriceCache struct {
	prices map[uuid.UUID]*AssetPriceCacheEntry
	mutex  sync.RWMutex
}

// NewAssetPriceCache creates a new asset price cache
func NewAssetPriceCache() *AssetPriceCache {
	return &AssetPriceCache{
		prices: make(map[uuid.UUID]*AssetPriceCacheEntry),
	}
}

type marketDataService struct {
	uow             repository.IUnitOfWork
	credRepo        repository.IMarketDataCredentialRepository
	providerManager providers.ProviderManager
	cache           cache.CandleCache
	security        SecurityService
	rateLimiter     RateLimiter

	// New fields for asset price management
	priceRepo       repository.IPriceRepository
	assetRepo       repository.IAssetRepository
	assetPriceCache *AssetPriceCache
	updateMutex     sync.RWMutex
}

// Price update scheduler
type priceUpdateScheduler struct {
	ticker   *time.Ticker
	stopChan chan struct{}
	running  bool
	mutex    sync.Mutex
}

var assetPriceScheduler = &priceUpdateScheduler{}

// NewMarketDataService creates a new enhanced market data service
func NewMarketDataService(
	uow repository.IUnitOfWork,
	candleRepo repository.ICandleRepository,
	credRepo repository.IMarketDataCredentialRepository,
	priceRepo repository.IPriceRepository,
	assetRepo repository.IAssetRepository,
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
		priceRepo:       priceRepo,
		assetRepo:       assetRepo,
		assetPriceCache: NewAssetPriceCache(),
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

// New asset price methods implementation

// GetCurrentAssetPrice retrieves the current price for an asset with caching
func (s *marketDataService) GetCurrentAssetPrice(ctx context.Context, assetID uuid.UUID) (*AssetPriceData, error) {
	if assetID == uuid.Nil {
		return nil, fmt.Errorf("asset ID is required")
	}

	// Check cache first
	if cachedPrice := s.assetPriceCache.Get(assetID); cachedPrice != nil {
		return cachedPrice, nil
	}

	// Get asset information
	asset, err := s.assetRepo.GetByUUID(ctx, assetID)
	if err != nil {
		return nil, fmt.Errorf("failed to get asset: %w", err)
	}

	if !asset.IsTradeable {
		return nil, fmt.Errorf("asset %s is not tradeable", asset.Name)
	}

	// Get latest price from database
	latestPrice, err := s.priceRepo.GetLatestPrice(ctx, assetID)
	if err != nil {
		// If no price in database, try to fetch from external source
		return s.fetchAndStoreAssetPriceFromProvider(ctx, asset)
	}

	// Check if price is stale
	maxAge := s.getMaxAgeForAssetType(asset.Type)
	isStale := time.Since(latestPrice.Timestamp) > maxAge

	priceData := &AssetPriceData{
		AssetID:   assetID,
		Price:     latestPrice.Price,
		Volume:    latestPrice.Volume,
		MarketCap: latestPrice.MarketCap,
		Timestamp: latestPrice.Timestamp,
		Source:    latestPrice.Source,
		IsStale:   isStale,
	}

	// If price is stale, try to update it in background
	if isStale {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			s.UpdateAssetPrice(ctx, assetID)
		}()
	}

	// Cache the result
	s.assetPriceCache.Set(assetID, priceData, 5*time.Minute)

	return priceData, nil
}

// GetCurrentAssetPrices retrieves current prices for multiple assets
func (s *marketDataService) GetCurrentAssetPrices(ctx context.Context, assetIDs []uuid.UUID) (map[uuid.UUID]*AssetPriceData, error) {
	if len(assetIDs) == 0 {
		return map[uuid.UUID]*AssetPriceData{}, nil
	}

	result := make(map[uuid.UUID]*AssetPriceData)
	var uncachedIDs []uuid.UUID

	// Check cache for each asset
	for _, assetID := range assetIDs {
		if cachedPrice := s.assetPriceCache.Get(assetID); cachedPrice != nil {
			result[assetID] = cachedPrice
		} else {
			uncachedIDs = append(uncachedIDs, assetID)
		}
	}

	// Fetch uncached prices from database
	if len(uncachedIDs) > 0 {
		latestPrices, err := s.priceRepo.GetLatestPrices(ctx, uncachedIDs)
		if err != nil {
			return nil, fmt.Errorf("failed to get latest prices: %w", err)
		}

		// Convert to AssetPriceData and check staleness
		for _, price := range latestPrices {
			asset, err := s.assetRepo.GetByUUID(ctx, price.AssetID)
			if err != nil {
				continue // Skip assets we can't retrieve
			}

			maxAge := s.getMaxAgeForAssetType(asset.Type)
			isStale := time.Since(price.Timestamp) > maxAge

			priceData := &AssetPriceData{
				AssetID:   price.AssetID,
				Price:     price.Price,
				Volume:    price.Volume,
				MarketCap: price.MarketCap,
				Timestamp: price.Timestamp,
				Source:    price.Source,
				IsStale:   isStale,
			}

			result[price.AssetID] = priceData
			s.assetPriceCache.Set(price.AssetID, priceData, 5*time.Minute)
		}
	}

	return result, nil
}

// UpdateAssetPrices updates prices for all tradeable assets
func (s *marketDataService) UpdateAssetPrices(ctx context.Context) error {
	s.updateMutex.Lock()
	defer s.updateMutex.Unlock()

	// Get all tradeable assets
	tradeableAssets, err := s.assetRepo.GetTradeableAssets(ctx)
	if err != nil {
		return fmt.Errorf("failed to get tradeable assets: %w", err)
	}

	if len(tradeableAssets) == 0 {
		return nil // No tradeable assets to update
	}

	// Group assets by market data source
	sourceGroups := make(map[string][]model.Asset)
	for _, asset := range tradeableAssets {
		source := "default"
		if asset.MarketDataSource != nil {
			source = *asset.MarketDataSource
		}
		sourceGroups[source] = append(sourceGroups[source], asset)
	}

	var allErrors []error

	// Update prices for each source group
	for sourceName, assets := range sourceGroups {
		if err := s.updateAssetsFromProvider(ctx, assets, sourceName); err != nil {
			allErrors = append(allErrors, fmt.Errorf("source %s: %w", sourceName, err))
		}
	}

	if len(allErrors) > 0 {
		return fmt.Errorf("price update errors: %v", allErrors)
	}

	return nil
}

// UpdateAssetPrice updates the price for a specific asset
func (s *marketDataService) UpdateAssetPrice(ctx context.Context, assetID uuid.UUID) (*AssetPriceData, error) {
	if assetID == uuid.Nil {
		return nil, fmt.Errorf("asset ID is required")
	}

	asset, err := s.assetRepo.GetByUUID(ctx, assetID)
	if err != nil {
		return nil, fmt.Errorf("failed to get asset: %w", err)
	}

	if !asset.IsTradeable {
		return nil, fmt.Errorf("asset %s is not tradeable", asset.Name)
	}

	return s.fetchAndStoreAssetPriceFromProvider(ctx, asset)
}

// SchedulePriceUpdates starts automatic price updates at the specified interval
func (s *marketDataService) SchedulePriceUpdates(ctx context.Context, interval time.Duration) error {
	assetPriceScheduler.mutex.Lock()
	defer assetPriceScheduler.mutex.Unlock()

	if assetPriceScheduler.running {
		return fmt.Errorf("price updates are already scheduled")
	}

	assetPriceScheduler.ticker = time.NewTicker(interval)
	assetPriceScheduler.stopChan = make(chan struct{})
	assetPriceScheduler.running = true

	go func() {
		for {
			select {
			case <-assetPriceScheduler.ticker.C:
				updateCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
				if err := s.UpdateAssetPrices(updateCtx); err != nil {
					// Log error but continue scheduling
					fmt.Printf("Scheduled asset price update failed: %v\n", err)
				}
				cancel()
			case <-assetPriceScheduler.stopChan:
				return
			}
		}
	}()

	return nil
}

// StopPriceUpdates stops automatic price updates
func (s *marketDataService) StopPriceUpdates() {
	assetPriceScheduler.mutex.Lock()
	defer assetPriceScheduler.mutex.Unlock()

	if !assetPriceScheduler.running {
		return
	}

	assetPriceScheduler.ticker.Stop()
	close(assetPriceScheduler.stopChan)
	assetPriceScheduler.running = false
}

// ValidateAssetPriceData validates price data for consistency and accuracy
func (s *marketDataService) ValidateAssetPriceData(ctx context.Context, price *model.AssetPrice) error {
	if price == nil {
		return fmt.Errorf("price data is required")
	}

	if price.AssetID == uuid.Nil {
		return fmt.Errorf("asset ID is required")
	}

	if price.Price.IsZero() || price.Price.IsNegative() {
		return fmt.Errorf("price must be positive")
	}

	if price.Volume != nil && *price.Volume < 0 {
		return fmt.Errorf("volume cannot be negative")
	}

	if price.MarketCap != nil && *price.MarketCap < 0 {
		return fmt.Errorf("market cap cannot be negative")
	}

	if price.Timestamp.IsZero() {
		return fmt.Errorf("timestamp is required")
	}

	if price.Timestamp.After(time.Now().Add(1 * time.Hour)) {
		return fmt.Errorf("timestamp cannot be in the future")
	}

	if price.Source == "" {
		return fmt.Errorf("price source is required")
	}

	return nil
}

// GetStaleAssetPrices retrieves assets with stale price data
func (s *marketDataService) GetStaleAssetPrices(ctx context.Context, maxAge time.Duration) ([]uuid.UUID, error) {
	return s.priceRepo.GetStaleAssets(ctx, maxAge)
}

// IsAssetPriceStale checks if an asset's price is stale
func (s *marketDataService) IsAssetPriceStale(ctx context.Context, assetID uuid.UUID, maxAge time.Duration) (bool, error) {
	latestPrice, err := s.priceRepo.GetLatestPrice(ctx, assetID)
	if err != nil {
		return true, err // No price data means stale
	}

	return time.Since(latestPrice.Timestamp) > maxAge, nil
}

// ClearAssetPriceCache clears the asset price cache
func (s *marketDataService) ClearAssetPriceCache() {
	s.assetPriceCache.Clear()
}

// GetAssetPriceCacheStats returns asset price cache statistics
func (s *marketDataService) GetAssetPriceCacheStats() AssetPriceCacheStats {
	return s.assetPriceCache.GetStats()
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

// Helper methods for asset price management

// fetchAndStoreAssetPriceFromProvider fetches price from external source and stores it
func (s *marketDataService) fetchAndStoreAssetPriceFromProvider(ctx context.Context, asset *model.Asset) (*AssetPriceData, error) {
	if asset.Symbol == nil {
		return nil, fmt.Errorf("asset symbol is required for price fetching")
	}

	// Convert asset price to candle request to reuse existing provider infrastructure
	now := time.Now()
	req := providers.CandleRequest{
		Symbol:    *asset.Symbol,
		AssetType: string(asset.Type),
		Interval:  model.Interval1m, // Use 1-minute interval for current price
		From:      now.Add(-5 * time.Minute),
		To:        now,
		Limit:     1,
	}

	// Try to get user credentials (use system user ID 0 for asset price updates)
	userCreds, _ := s.credRepo.ListByUser(ctx, 0)
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

	// Get providers for this asset type
	providerList := s.providerManager.GetProvidersForAssetType(string(asset.Type))

	for _, provider := range providerList {
		// Check if provider supports 1-minute interval
		caps := provider.Capabilities()
		supportsInterval := false
		for _, supportedInterval := range caps.Intervals {
			if supportedInterval == model.Interval1m {
				supportsInterval = true
				break
			}
		}
		if !supportsInterval {
			continue
		}

		// Get API key if required
		if caps.RequiresAPIKey {
			apiKey, exists := credMap[provider.ID()]
			if !exists || apiKey == "" {
				continue
			}
			req.APIKey = apiKey
		}

		// Fetch candle data
		response, err := provider.GetCandles(ctx, req)
		if err != nil || len(response.Candles) == 0 {
			continue
		}

		// Convert candle to asset price
		candle := response.Candles[len(response.Candles)-1] // Get most recent candle

		// Convert Money to decimal.Decimal
		price := decimal.NewFromInt(int64(candle.Close)).Div(decimal.NewFromInt(100))

		assetPrice := &model.AssetPrice{
			AssetID:   asset.ID,
			Price:     price,
			Timestamp: candle.Timestamp,
			Source:    candle.Source,
		}

		// Convert volume if available
		if candle.Volume > 0 {
			volume := int64(candle.Volume)
			assetPrice.Volume = &volume
		}

		// Validate price data
		if err := s.ValidateAssetPriceData(ctx, assetPrice); err != nil {
			continue
		}

		// Store in database
		if _, err := s.priceRepo.Create(ctx, assetPrice); err != nil {
			continue
		}

		// Create result
		priceData := &AssetPriceData{
			AssetID:   asset.ID,
			Price:     price,
			Volume:    assetPrice.Volume,
			MarketCap: assetPrice.MarketCap,
			Timestamp: assetPrice.Timestamp,
			Source:    assetPrice.Source,
			IsStale:   false,
		}

		// Cache the result
		s.assetPriceCache.Set(asset.ID, priceData, 5*time.Minute)

		return priceData, nil
	}

	return nil, fmt.Errorf("no providers returned data for %s %s", asset.Type, *asset.Symbol)
}

// updateAssetsFromProvider updates prices for a group of assets from the same provider
func (s *marketDataService) updateAssetsFromProvider(ctx context.Context, assets []model.Asset, sourceName string) error {
	// For now, update assets individually since we're reusing the candle infrastructure
	// This could be optimized later with batch requests
	for _, asset := range assets {
		if asset.Symbol != nil {
			_, err := s.fetchAndStoreAssetPriceFromProvider(ctx, &asset)
			if err != nil {
				// Log error but continue with other assets
				continue
			}
		}
	}
	return nil
}

// getMaxAgeForAssetType returns the maximum age for price data based on asset type
func (s *marketDataService) getMaxAgeForAssetType(assetType model.AssetType) time.Duration {
	switch assetType {
	case model.AssetTypeStock:
		return 15 * time.Minute // Stock prices update every 15 minutes during market hours
	case model.AssetTypeCrypto:
		return 5 * time.Minute // Crypto prices update every 5 minutes
	default:
		return 1 * time.Hour // Default for other asset types
	}
}

// AssetPriceCache implementation methods

func (c *AssetPriceCache) Get(assetID uuid.UUID) *AssetPriceData {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	cached, exists := c.prices[assetID]
	if !exists {
		return nil
	}

	if time.Now().After(cached.ExpiresAt) {
		delete(c.prices, assetID)
		return nil
	}

	return cached.Data
}

func (c *AssetPriceCache) Set(assetID uuid.UUID, price *AssetPriceData, ttl time.Duration) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	now := time.Now()
	c.prices[assetID] = &AssetPriceCacheEntry{
		Data:      price,
		CachedAt:  now,
		ExpiresAt: now.Add(ttl),
	}
}

func (c *AssetPriceCache) Clear() {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	c.prices = make(map[uuid.UUID]*AssetPriceCacheEntry)
}

func (c *AssetPriceCache) GetStats() AssetPriceCacheStats {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	totalEntries := len(c.prices)
	if totalEntries == 0 {
		return AssetPriceCacheStats{
			TotalEntries: 0,
			HitRate:      0,
			MissRate:     0,
			AvgAge:       0,
		}
	}

	now := time.Now()
	var totalAge time.Duration
	for _, cached := range c.prices {
		totalAge += now.Sub(cached.CachedAt)
	}

	avgAge := totalAge / time.Duration(totalEntries)

	return AssetPriceCacheStats{
		TotalEntries: totalEntries,
		HitRate:      0, // Would need hit/miss counters for accurate calculation
		MissRate:     0,
		AvgAge:       avgAge,
	}
}
