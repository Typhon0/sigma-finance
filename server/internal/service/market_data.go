package service

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"sigma_finance/internal/config"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service/cache"
	"sigma_finance/internal/service/providers"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

func isLikelyPlaintextAPIKey(key string) bool {
	if key == "" {
		return false
	}
	if len(key) < 10 {
		return false
	}
	if strings.Contains(key, "+") || strings.Contains(key, "/") || strings.Contains(key, "=") {
		if len(key) > 40 {
			return false
		}
	}
	keyRegex := regexp.MustCompile(`^[A-Za-z0-9]+$`)
	return keyRegex.MatchString(key)
}

// MarketDataService orchestrates provider selection, credential lookup and caching persistence.
type MarketDataService interface {
	// Existing candle-based methods
	GetCandles(ctx context.Context, userID string, symbol, assetType string, interval model.CandleInterval, from, to time.Time, limit int) ([]model.Candle, error)
	GetRealTimePrice(ctx context.Context, userID string, symbol, assetType string) (*model.Candle, error)
	ValidateProviderCredentials(ctx context.Context, userID string, providerID, apiKey string) error
	GetSupportedProviders(assetType string) []ProviderInfo
	GetProviderHealth(ctx context.Context) []providers.ProviderHealthEntry
	GetTechnicalIndicator(ctx context.Context, userID string, symbol, assetType, indicator string, interval model.CandleInterval, timePeriod int, seriesType string, from, to time.Time) (*providers.TechnicalIndicatorResponse, error)

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
	db              *bun.DB
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
	db *bun.DB,
	candleRepo repository.ICandleRepository,
	credRepo repository.IMarketDataCredentialRepository,
	priceRepo repository.IPriceRepository,
	assetRepo repository.IAssetRepository,
	security SecurityService,
	rateLimiter RateLimiter,
	cfg *config.Config,
) MarketDataService {
	// Create provider manager and register providers
	providerManager := providers.NewProviderManager()

	// Register crypto providers
	providerManager.RegisterProvider(providers.NewBinanceProvider())
	providerManager.RegisterProvider(providers.NewCryptoCompareProvider())
	providerManager.RegisterProvider(providers.NewAlphaVantageProvider())

	// Register stock providers
	providerManager.RegisterProvider(providers.NewFinnhubProvider())
	providerManager.RegisterProvider(providers.NewTwelveDataProvider())
	providerManager.RegisterProvider(providers.NewTiingoProvider())

	// Register YFinance as tier 3 fallback provider (if socket path configured)
	if cfg != nil && cfg.MarketData.YFinance.Host != "" {
		yfinanceProvider, err := providers.NewYFinanceProvider(providers.YFinanceConfig{
			Host: cfg.MarketData.YFinance.Host,
			Port: cfg.MarketData.YFinance.Port,
		})
		if err != nil {
			log.Printf("[NewMarketDataService] WARNING: Failed to create YFinance provider: %v", err)
		} else {
			providerManager.RegisterProvider(yfinanceProvider)
			log.Printf("[NewMarketDataService] YFinance provider registered (tier 3 fallback)")
		}
	}

	// Create cache with 1000 entries and 5-minute staleness threshold
	candleCache := cache.NewCandleCache(candleRepo, 1000, 5*time.Minute)

	return &marketDataService{
		uow:             uow,
		db:              db,
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

func (s *marketDataService) GetCandles(ctx context.Context, userID string, symbol, assetType string, interval model.CandleInterval, from, to time.Time, limit int) ([]model.Candle, error) {
	// Check rate limiting
	if userID != "" && s.rateLimiter != nil {
		if err := s.rateLimiter.CheckRateLimit(ctx, fmt.Sprintf("candles:user:%s", userID), 60, time.Minute); err != nil {
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

func (s *marketDataService) GetRealTimePrice(ctx context.Context, userID string, symbol, assetType string) (*model.Candle, error) {
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

func (s *marketDataService) ValidateProviderCredentials(ctx context.Context, userID string, providerID, apiKey string) error {
	provider, exists := s.providerManager.GetProvider(providerID)
	if !exists {
		return fmt.Errorf("unknown provider: %s", providerID)
	}

	return provider.ValidateCredentials(ctx, apiKey)
}

func (s *marketDataService) GetSupportedProviders(assetType string) []ProviderInfo {
	var providers []providers.Provider
	if assetType == "" {
		providers = s.providerManager.GetAllProviders()
	} else {
		providers = s.providerManager.GetProvidersForAssetType(assetType)
	}

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

func (s *marketDataService) GetProviderHealth(ctx context.Context) []providers.ProviderHealthEntry {
	// Collect all unique providers and their supported asset types.
	// We derive asset types from each provider's Capabilities() rather than
	// hardcoding, so new types (e.g. FOREX) are automatically included.
	// Providers implementing AssetTypeHealthChecker (like YFinance) test
	// with type-appropriate symbols (e.g. BTC-USD for CRYPTO, AAPL for STOCK).
	type checkSpec struct {
		provider  providers.Provider
		assetType string
	}

	seen := make(map[string]map[string]bool) // providerID -> {assetType: true}
	var checks []checkSpec

	for _, p := range s.providerManager.GetAllProviders() {
		caps := p.Capabilities()
		if seen[p.ID()] == nil {
			seen[p.ID()] = make(map[string]bool)
		}
		for _, at := range caps.AssetTypes {
			if !seen[p.ID()][at] {
				seen[p.ID()][at] = true
				checks = append(checks, checkSpec{provider: p, assetType: at})
			}
		}
	}

	// Run all health checks concurrently so one slow provider
	// (e.g. YFinance sidecar down) doesn't block the rest.
	type healthResult struct {
		providerID string
		assetType  string
		healthy    bool
	}
	ch := make(chan healthResult, len(checks))

	for _, spec := range checks {
		spec := spec // capture
		go func() {
			// Each health check gets its own 3-second timeout
			// so a single unresponsive provider can't stall the batch.
			hcCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
			defer cancel()

			var healthy bool
			if hc, ok := spec.provider.(providers.AssetTypeHealthChecker); ok {
				healthy = hc.IsHealthyForAssetType(hcCtx, spec.assetType)
			} else {
				healthy = spec.provider.IsHealthy(hcCtx)
			}

			ch <- healthResult{
				providerID: spec.provider.ID(),
				assetType:  spec.assetType,
				healthy:    healthy,
			}
		}()
	}

	results := make([]providers.ProviderHealthEntry, 0, len(checks))
	for i := 0; i < len(checks); i++ {
		r := <-ch
		results = append(results, providers.ProviderHealthEntry{
			Provider:  r.providerID,
			AssetType: r.assetType,
			Healthy:   r.healthy,
		})
	}

	return results
}

// GetTechnicalIndicator retrieves technical indicator data from providers
func (s *marketDataService) GetTechnicalIndicator(ctx context.Context, userID string, symbol, assetType, indicator string, interval model.CandleInterval, timePeriod int, seriesType string, from, to time.Time) (*providers.TechnicalIndicatorResponse, error) {
	// Get user's API keys
	userCreds, _ := s.credRepo.ListByUser(ctx, userID)
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
		caps := provider.Capabilities()

		// Get API key if required
		apiKey := ""
		if caps.RequiresAPIKey {
			var exists bool
			apiKey, exists = credMap[provider.ID()]
			if !exists || apiKey == "" {
				continue
			}
		}

		// Check rate limiting
		if s.rateLimiter != nil {
			rateLimitKey := fmt.Sprintf("provider:%s:indicator:user:%s", provider.ID(), userID)
			if err := s.rateLimiter.CheckRateLimit(ctx, rateLimitKey, caps.RateLimit.RequestsPerMinute, time.Minute); err != nil {
				continue
			}
		}

		req := providers.TechnicalIndicatorRequest{
			Symbol:     symbol,
			AssetType:  assetType,
			Indicator:  indicator,
			TimePeriod: timePeriod,
			SeriesType: seriesType,
			Interval:   interval,
			From:       from,
			To:         to,
			APIKey:     apiKey,
		}

		response, err := provider.GetTechnicalIndicator(ctx, req)
		if err != nil {
			continue
		}

		if len(response.Data) > 0 {
			return response, nil
		}
	}

	return nil, fmt.Errorf("no providers returned technical indicator data for %s %s", assetType, symbol)
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
	assetIDStr := assetID.String()
	asset, err := s.assetRepo.GetByID(ctx, assetIDStr)
	if err != nil {
		return nil, fmt.Errorf("failed to get asset: %w", err)
	}

	if !asset.IsTradeable {
		return nil, fmt.Errorf("asset %s is not tradeable", asset.Name)
	}

	// Get latest price from database
	latestPrice, err := s.priceRepo.GetLatestPrice(ctx, assetIDStr)
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
		// Convert UUIDs to strings for repository call
		uncachedIDStrs := make([]string, len(uncachedIDs))
		for i, id := range uncachedIDs {
			uncachedIDStrs[i] = id.String()
		}

		latestPrices, err := s.priceRepo.GetLatestPrices(ctx, uncachedIDStrs)
		if err != nil {
			return nil, fmt.Errorf("failed to get latest prices: %w", err)
		}

		// Convert to AssetPriceData and check staleness
		for _, price := range latestPrices {
			assetID, err := uuid.Parse(price.AssetID)
			if err != nil {
				continue // Skip assets with invalid UUIDs
			}

			asset, err := s.assetRepo.GetByID(ctx, price.AssetID)
			if err != nil {
				continue // Skip assets we can't retrieve
			}

			maxAge := s.getMaxAgeForAssetType(asset.Type)
			isStale := time.Since(price.Timestamp) > maxAge

			priceData := &AssetPriceData{
				AssetID:   assetID,
				Price:     price.Price,
				Volume:    price.Volume,
				MarketCap: price.MarketCap,
				Timestamp: price.Timestamp,
				Source:    price.Source,
				IsStale:   isStale,
			}

			result[assetID] = priceData
			s.assetPriceCache.Set(assetID, priceData, 5*time.Minute)
		}
	}

	return result, nil
}

// UpdateAssetPrices updates prices for all tradeable assets
func (s *marketDataService) UpdateAssetPrices(ctx context.Context) error {
	s.updateMutex.Lock()
	defer s.updateMutex.Unlock()

	// Ensure partitions exist before trying to insert
	if err := s.ensurePricePartitions(ctx); err != nil {
		log.Printf("[UpdateAssetPrices] WARNING: could not ensure partitions: %v", err)
	}

	// Get all tradeable assets
	tradeableAssets, err := s.assetRepo.GetTradeableAssets(ctx)
	if err != nil {
		log.Printf("[UpdateAssetPrices] ERROR: failed to get tradeable assets: %v", err)
		return fmt.Errorf("failed to get tradeable assets: %w", err)
	}

	if len(tradeableAssets) == 0 {
		log.Printf("[UpdateAssetPrices] WARNING: No tradeable assets found in database. Assets need is_tradeable=true to have prices fetched.")
		return nil // No tradeable assets to update
	}

	log.Printf("[UpdateAssetPrices] Found %d tradeable assets to update", len(tradeableAssets))

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

	assetIDStr := assetID.String()
	asset, err := s.assetRepo.GetByID(ctx, assetIDStr)
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

	if price.AssetID == "" {
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
	staleAssetIDStrs, err := s.priceRepo.GetStaleAssets(ctx, maxAge)
	if err != nil {
		return nil, err
	}

	// Convert string IDs to UUIDs
	staleAssetIDs := make([]uuid.UUID, 0, len(staleAssetIDStrs))
	for _, idStr := range staleAssetIDStrs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			continue // Skip invalid UUIDs
		}
		staleAssetIDs = append(staleAssetIDs, id)
	}

	return staleAssetIDs, nil
}

// IsAssetPriceStale checks if an asset's price is stale
func (s *marketDataService) IsAssetPriceStale(ctx context.Context, assetID uuid.UUID, maxAge time.Duration) (bool, error) {
	assetIDStr := assetID.String()
	latestPrice, err := s.priceRepo.GetLatestPrice(ctx, assetIDStr)
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

func (s *marketDataService) fetchCandlesFromProviders(ctx context.Context, userID string, symbol, assetType string, interval model.CandleInterval, from, to time.Time, limit int) ([]model.Candle, error) {
	log.Printf("[fetchCandlesFromProviders] symbol=%s assetType=%s interval=%s", symbol, assetType, interval)
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
			} else {
				log.Printf("[fetchCandlesFromProviders] decrypt failed %s: %v", cred.Provider, err)
			}
		}
		credMap[cred.Provider] = apiKey
	}
	log.Printf("[fetchCandlesFromProviders] creds: %v", credMap)

	// Try providers in order of preference
	providerList := s.providerManager.GetProvidersForAssetType(assetType)

	for _, provider := range providerList {
		log.Printf("[fetchCandlesFromProviders] trying: %s", provider.ID())
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
			rateLimitKey := fmt.Sprintf("provider:%s:user:%s", provider.ID(), userID)
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
		log.Printf("[fetchAndStoreAssetPriceFromProvider] ERROR: Asset '%s' (ID: %s) has no symbol - cannot fetch price", asset.Name, asset.ID)
		return nil, fmt.Errorf("asset symbol is required for price fetching")
	}

	log.Printf("[fetchAndStoreAssetPriceFromProvider] Fetching price for asset '%s' (Symbol: %s, Type: %s)", asset.Name, *asset.Symbol, asset.Type)

	// Try to get system-wide credentials first (admin-set for all users)
	credMap := make(map[string]string)

	systemCreds, err := s.credRepo.ListSystemWide(ctx)
	if err != nil {
		log.Printf("[fetchAndStoreAssetPriceFromProvider] WARNING: Failed to get system-wide credentials: %v", err)
	}

	// If no system-wide credentials, get ALL credentials from DB
	if len(systemCreds) == 0 {
		log.Printf("[fetchAndStoreAssetPriceFromProvider] No system-wide API keys. Getting all credentials...")

		allCreds, err := s.credRepo.ListAll(ctx)
		if err == nil && len(allCreds) > 0 {
			log.Printf("[fetchAndStoreAssetPriceFromProvider] Found %d credentials in database", len(allCreds))
			for _, cred := range allCreds {
				log.Printf("[fetchAndStoreAssetPriceFromProvider] Found credential: provider=%s, is_system=%v, user_id=%s",
					cred.Provider, cred.IsSystem, cred.UserID)
			}
			systemCreds = allCreds
		}
	}

	if len(systemCreds) == 0 {
		log.Printf("[fetchAndStoreAssetPriceFromProvider] ERROR: No API keys configured at all. Please configure API keys via UI or insert system-wide credentials directly.")
	} else {
		log.Printf("[fetchAndStoreAssetPriceFromProvider] Found %d credentials to try", len(systemCreds))
	}

	for i := range systemCreds {
		cred := &systemCreds[i]
		apiKey := ""
		decryptionSuccess := false
		originalKey := cred.APIKey

		decryptedKey := originalKey

		// Try SecurityService.DecryptString first
		if s.security != nil && originalKey != "" {
			if decrypted, err := s.security.DecryptString(originalKey); err == nil {
				decryptedKey = decrypted
			}
		}

		// Check if SecurityService result is plaintext
		if isLikelyPlaintextAPIKey(decryptedKey) {
			apiKey = decryptedKey
			decryptionSuccess = true
			log.Printf("[fetchAndStoreAssetPriceFromProvider] Successfully decrypted API key for %s via SecurityService", cred.Provider)
		} else if originalKey != "" {
			// Try model.Decrypt() as fallback - use pointer to actually modify
			if decryptErr := cred.Decrypt(); decryptErr == nil {
				if isLikelyPlaintextAPIKey(cred.APIKey) {
					apiKey = cred.APIKey
					decryptionSuccess = true
					log.Printf("[fetchAndStoreAssetPriceFromProvider] Successfully decrypted API key for %s via model.Decrypt", cred.Provider)
				}
			}
		}

		// Last resort: if still looks encrypted, DON'T use it
		if !decryptionSuccess {
			log.Printf("[fetchAndStoreAssetPriceFromProvider] CRITICAL: Could not decrypt API key for %s (tried both methods). Key stored with different ENCRYPTION_KEY. Skipping provider.", cred.Provider)
			continue
		}

		credMap[cred.Provider] = apiKey
		log.Printf("[fetchAndStoreAssetPriceFromProvider] Using API key for provider: %s", cred.Provider)
	}

	// Get providers for this asset type
	providerList := s.providerManager.GetProvidersForAssetType(string(asset.Type))
	log.Printf("[fetchAndStoreAssetPriceFromProvider] Found %d providers for asset type %s", len(providerList), asset.Type)

	var lastError error
	for _, provider := range providerList {
		caps := provider.Capabilities()

		// Get API key if required
		apiKey := ""
		if caps.RequiresAPIKey {
			apiKey, _ = credMap[provider.ID()]
			if apiKey == "" {
				log.Printf("[fetchAndStoreAssetPriceFromProvider] SKIP: Provider %s requires API key but none configured", provider.ID())
				lastError = fmt.Errorf("no API key for provider %s", provider.ID())
				continue
			}
			log.Printf("[fetchAndStoreAssetPriceFromProvider] Using API key for provider %s", provider.ID())
		}

		quoteReq := providers.QuoteRequest{
			Symbol:    *asset.Symbol,
			AssetType: string(asset.Type),
			APIKey:    apiKey,
		}

		log.Printf("[fetchAndStoreAssetPriceFromProvider] Calling provider %s with API key: %q", provider.ID(), apiKey)

		quoteResp, err := provider.GetQuote(ctx, quoteReq)
		if err != nil {
			log.Printf("[fetchAndStoreAssetPriceFromProvider] Provider %s GetQuote error: %v", provider.ID(), err)
			lastError = err
		} else if quoteResp != nil {
			log.Printf("[fetchAndStoreAssetPriceFromProvider] Provider %s returned price: %s", provider.ID(), quoteResp.Last.String())
		}
		if err == nil && quoteResp != nil && !quoteResp.Last.IsZero() {
			log.Printf("[fetchAndStoreAssetPriceFromProvider] Price timestamp from Tiingo: %s", quoteResp.Timestamp.String())
			assetPrice := &model.AssetPrice{
				AssetID:   asset.ID,
				Price:     quoteResp.Last,
				Timestamp: quoteResp.Timestamp,
				Source:    quoteResp.Source,
			}

			if quoteResp.Volume > 0 {
				volume := quoteResp.Volume
				assetPrice.Volume = &volume
			}

			// Validate price data
			if err := s.ValidateAssetPriceData(ctx, assetPrice); err != nil {
				log.Printf("[fetchAndStoreAssetPriceFromProvider] Validation failed for %s: %v - trying other providers", *asset.Symbol, err)
			} else {
				// Store in database
				if _, err := s.priceRepo.Create(ctx, assetPrice); err != nil {
					// Try direct insert into partition table
					partitionErr := s.tryDirectPartitionInsert(ctx, assetPrice)
					if partitionErr != nil {
						log.Printf("[fetchAndStoreAssetPriceFromProvider] DB store failed for %s: %v, partition insert also failed: %v", *asset.Symbol, err, partitionErr)
					} else {
						// SUCCESS via partition insert
						assetUUID, _ := uuid.Parse(asset.ID)
						priceData := &AssetPriceData{
							AssetID:   assetUUID,
							Price:     quoteResp.Last,
							Volume:    assetPrice.Volume,
							Timestamp: quoteResp.Timestamp,
							Source:    quoteResp.Source,
							IsStale:   false,
						}
						log.Printf("[fetchAndStoreAssetPriceFromProvider] SUCCESS: Stored price %s for asset %s via partition", quoteResp.Last.String(), *asset.Symbol)
						s.assetPriceCache.Set(assetUUID, priceData, 5*time.Minute)
						return priceData, nil
					}
				} else {
					// SUCCESS - return immediately!
					assetUUID, err := uuid.Parse(asset.ID)
					if err != nil {
						return nil, fmt.Errorf("invalid asset ID format: %w", err)
					}

					priceData := &AssetPriceData{
						AssetID:   assetUUID,
						Price:     quoteResp.Last,
						Volume:    assetPrice.Volume,
						Timestamp: quoteResp.Timestamp,
						Source:    quoteResp.Source,
						IsStale:   false,
					}

					log.Printf("[fetchAndStoreAssetPriceFromProvider] SUCCESS: Stored price %s for asset %s", quoteResp.Last.String(), *asset.Symbol)
					s.assetPriceCache.Set(assetUUID, priceData, 5*time.Minute)
					return priceData, nil
				}
			}
		}

		now := time.Now()
		req := providers.CandleRequest{
			Symbol:    *asset.Symbol,
			AssetType: string(asset.Type),
			Interval:  model.Interval1m,
			From:      now.Add(-5 * time.Minute),
			To:        now,
			Limit:     1,
			APIKey:    apiKey,
		}

		// Check if provider supports 1-minute interval
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

		response, err := provider.GetCandles(ctx, req)
		if err != nil || len(response.Candles) == 0 {
			continue
		}

		candle := response.Candles[len(response.Candles)-1]
		price := decimal.NewFromInt(int64(candle.Close)).Div(decimal.NewFromInt(100))

		assetPrice := &model.AssetPrice{
			AssetID:   asset.ID,
			Price:     price,
			Timestamp: candle.Timestamp,
			Source:    candle.Source,
		}

		if candle.Volume > 0 {
			volume := int64(candle.Volume)
			assetPrice.Volume = &volume
		}

		if err := s.ValidateAssetPriceData(ctx, assetPrice); err != nil {
			continue
		}

		if _, err := s.priceRepo.Create(ctx, assetPrice); err != nil {
			continue
		}

		assetUUID, err := uuid.Parse(asset.ID)
		if err != nil {
			return nil, fmt.Errorf("invalid asset ID format: %w", err)
		}

		priceData := &AssetPriceData{
			AssetID:   assetUUID,
			Price:     price,
			Volume:    assetPrice.Volume,
			Timestamp: assetPrice.Timestamp,
			Source:    assetPrice.Source,
			IsStale:   false,
		}

		s.assetPriceCache.Set(assetUUID, priceData, 5*time.Minute)
		return priceData, nil
	}

	if lastError != nil {
		log.Printf("[fetchAndStoreAssetPriceFromProvider] ERROR: All providers failed for %s %s. Last error: %v", asset.Type, *asset.Symbol, lastError)
		return nil, fmt.Errorf("no providers returned data for %s %s: %w", asset.Type, *asset.Symbol, lastError)
	}
	return nil, fmt.Errorf("no providers returned data for %s %s", asset.Type, *asset.Symbol)
}

// updateAssetsFromProvider updates prices for a group of assets from the same provider
func (s *marketDataService) updateAssetsFromProvider(ctx context.Context, assets []model.Asset, sourceName string) error {
	// For now, update assets individually since we're reusing the candle infrastructure
	// This could be optimized later with batch requests
	successCount := 0
	for _, asset := range assets {
		if asset.Symbol != nil {
			_, err := s.fetchAndStoreAssetPriceFromProvider(ctx, &asset)
			if err != nil {
				// Log error but continue with other assets
				log.Printf("[updateAssetsFromProvider] Failed to update price for asset %s: %v", asset.Name, err)
				continue
			}
			successCount++
		} else {
			log.Printf("[updateAssetsFromProvider] SKIP: Asset '%s' has no symbol", asset.Name)
		}
	}
	log.Printf("[updateAssetsFromProvider] Updated prices for %d/%d assets from source %s", successCount, len(assets), sourceName)
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

// ensurePricePartitions creates partitions for the current and next month if they don't exist
func (s *marketDataService) ensurePricePartitions(ctx context.Context) error {
	now := time.Now()
	year := now.Year()

	// Create current and next month partitions
	for offset := 0; offset <= 1; offset++ {
		month := int(now.Month()) + offset
		yr := year
		if month > 12 {
			month -= 12
			yr++
		}

		partName := fmt.Sprintf("asset_prices_%d_%02d", yr, month)
		nextMonth := month + 1
		nextYear := yr
		if nextMonth > 12 {
			nextMonth = 1
			nextYear++
		}
		query := fmt.Sprintf(`
			CREATE TABLE IF NOT EXISTS sigma_finance.%s PARTITION OF sigma_finance.asset_prices
			FOR VALUES FROM ('%d-%02d-01') TO ('%d-%02d-01')
		`, partName, yr, month, nextYear, nextMonth)

		result, err := s.db.ExecContext(ctx, query)
		if err != nil {
			log.Printf("[ensurePricePartitions] ERROR creating partition %s: %v (result: %v)", partName, err, result)
		} else {
			log.Printf("[ensurePricePartitions] Created/verified partition: %s", partName)
		}
	}
	return nil
}

// tryDirectPartitionInsert attempts to insert directly into the specific partition table
func (s *marketDataService) tryDirectPartitionInsert(ctx context.Context, assetPrice *model.AssetPrice) error {
	ts := assetPrice.Timestamp
	year := ts.Year()
	month := ts.Month()
	partName := fmt.Sprintf("asset_prices_%d_%02d", year, month)

	query := fmt.Sprintf(`
		INSERT INTO sigma_finance.%s (asset_id, price, timestamp, source, volume, market_cap)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, partName)

	_, err := s.db.ExecContext(ctx, query, assetPrice.AssetID, assetPrice.Price, assetPrice.Timestamp, assetPrice.Source, assetPrice.Volume, assetPrice.MarketCap)
	return err
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
