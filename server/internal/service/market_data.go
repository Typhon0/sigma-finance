package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"regexp"
	"sigma_finance/internal/config"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service/cache"
	marketdatastore "sigma_finance/internal/service/marketdata/store"
	"sigma_finance/internal/service/providers"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
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
	GetCandlesByInstrument(ctx context.Context, userID string, instrumentID string, interval model.CandleInterval, from, to time.Time, limit int, preferredProvider *string) (*InstrumentCandlesResult, error)
	GetRealTimePriceByInstrument(ctx context.Context, userID string, instrumentID string, preferredProvider *string) (*InstrumentCandlesResult, error)
	GetAvailableProviders(ctx context.Context, userID string, instrumentID string, dataType string) ([]AvailableProviderStatus, error)
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
	BackfillAssetPrices(ctx context.Context, userID string, assetID uuid.UUID, instrumentID string, from, to time.Time) (*HistoricalBackfillOutcome, error)
}

type RuntimeMarketDataCacheInvalidator interface {
	InvalidateRuntimeMarketDataCacheForUser(userID string, reason string) int
	InvalidateRuntimeMarketDataCacheForInstrument(instrumentID string, reason string) int
	GetRuntimeMarketDataInvalidationStats() RuntimeMarketDataInvalidationStats
}

const (
	RuntimeCacheInvalidationReasonCredential = "credential"
	RuntimeCacheInvalidationReasonMapping    = "mapping"
	RuntimeCacheInvalidationReasonOther      = "other"
)

type RuntimeMarketDataInvalidationStats struct {
	TotalEvents         uint64 `json:"total_events"`
	TotalEntriesRemoved uint64 `json:"total_entries_removed"`
	CredentialEvents    uint64 `json:"credential_events"`
	MappingEvents       uint64 `json:"mapping_events"`
	OtherEvents         uint64 `json:"other_events"`
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

type ProviderFailure struct {
	Provider string
	Reason   string
}

type InstrumentCandlesResult struct {
	Candles        []model.Candle
	SourceProvider string
	FallbackUsed   bool
	Failures       []ProviderFailure
}

type AvailableProviderStatus struct {
	Provider         string
	Capability       bool
	RequiresAPIKey   bool
	HasCredential    bool
	CredentialValid  bool
	CredentialEnable bool
	Priority         int
	MappingStatus    string
	EffectiveEnabled bool
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

type instrumentCandlesCacheEntry struct {
	Result    *InstrumentCandlesResult
	CachedAt  time.Time
	ExpiresAt time.Time
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
	instrumentRepo  repository.IInstrumentRepository
	providerManager providers.ProviderManager
	mappingService  InstrumentProviderMappingService
	cache           cache.CandleCache
	security        SecurityService
	rateLimiter     RateLimiter
	candleStore     marketdatastore.CandleOverlayStore

	// New fields for asset price management
	priceRepo       repository.IPriceRepository
	assetRepo       repository.IAssetRepository
	assetPriceCache *AssetPriceCache
	runtimeCache    map[string]*instrumentCandlesCacheEntry
	runtimeCacheMu  sync.RWMutex

	runtimeInvalidationTotalEvents         uint64
	runtimeInvalidationTotalEntriesRemoved uint64
	runtimeInvalidationCredentialEvents    uint64
	runtimeInvalidationMappingEvents       uint64
	runtimeInvalidationOtherEvents         uint64

	updateMutex sync.RWMutex
	db          *bun.DB
}

type HistoricalBackfillError struct {
	Code     string
	Provider string
	Symbol   string
	Message  string
	Err      error
}

type HistoricalBackfillOutcome struct {
	RowsTouched      int
	RowsInserted     int
	RowsUpdated      int
	RowsSkipped      int
	RequestedFrom    time.Time
	RequestedTo      time.Time
	AffectedFrom     *time.Time
	AffectedTo       *time.Time
	FetchedWindows   int
	SkippedAsCovered bool
	ProviderSymbol   string
}

func (e *HistoricalBackfillError) Error() string {
	if e == nil {
		return ""
	}
	parts := []string{}
	if e.Message != "" {
		parts = append(parts, e.Message)
	}
	if e.Provider != "" {
		parts = append(parts, "provider="+e.Provider)
	}
	if e.Symbol != "" {
		parts = append(parts, "symbol="+e.Symbol)
	}
	if e.Err != nil {
		parts = append(parts, "cause="+e.Err.Error())
	}
	return strings.Join(parts, " ")
}

func (e *HistoricalBackfillError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
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
	dbCandleStore := marketdatastore.NewDBCandleStore(candleRepo)
	packRepo := repository.NewMarketDataPackRepository(db)
	hybridCandleStore := marketdatastore.NewHybridCandleStore(
		marketdatastore.NewPackCandleStore(packRepo),
		dbCandleStore,
	)

	return &marketDataService{
		uow:             uow,
		db:              db,
		credRepo:        credRepo,
		instrumentRepo:  uow.Instrument(),
		providerManager: providerManager,
		mappingService:  NewInstrumentProviderMappingService(uow),
		cache:           candleCache,
		security:        security,
		rateLimiter:     rateLimiter,
		candleStore:     hybridCandleStore,
		priceRepo:       priceRepo,
		assetRepo:       assetRepo,
		assetPriceCache: NewAssetPriceCache(),
		runtimeCache:    make(map[string]*instrumentCandlesCacheEntry),
	}
}

func (s *marketDataService) GetCandles(ctx context.Context, userID string, symbol, assetType string, interval model.CandleInterval, from, to time.Time, limit int) ([]model.Candle, error) {
	instrumentID, err := s.resolveInstrumentIDBySymbol(ctx, symbol, assetType)
	if err != nil {
		return nil, err
	}

	result, err := s.GetCandlesByInstrument(ctx, userID, instrumentID, interval, from, to, limit, nil)
	if err != nil {
		return nil, err
	}

	return result.Candles, nil
}

func (s *marketDataService) GetRealTimePrice(ctx context.Context, userID string, symbol, assetType string) (*model.Candle, error) {
	instrumentID, err := s.resolveInstrumentIDBySymbol(ctx, symbol, assetType)
	if err != nil {
		return nil, err
	}
	result, err := s.GetRealTimePriceByInstrument(ctx, userID, instrumentID, nil)
	if err != nil {
		return nil, err
	}
	candles := result.Candles

	if len(candles) == 0 {
		return nil, fmt.Errorf("no recent price data available")
	}

	return &candles[len(candles)-1], nil
}

func (s *marketDataService) GetCandlesByInstrument(ctx context.Context, userID string, instrumentID string, interval model.CandleInterval, from, to time.Time, limit int, preferredProvider *string) (*InstrumentCandlesResult, error) {
	if strings.TrimSpace(instrumentID) == "" {
		return nil, fmt.Errorf("instrumentId is required")
	}

	instrument, err := s.instrumentRepo.GetByID(ctx, instrumentID)
	if err != nil {
		return nil, err
	}

	if interval == "" {
		interval = model.Interval1d
	}
	if limit <= 0 {
		limit = 500
	}

	if s.candleStore != nil {
		quoteCurrency := strings.ToUpper(strings.TrimSpace(firstNonEmpty(
			stringOrEmpty(instrument.QuoteCurrency),
			stringOrEmpty(instrument.Currency),
			"USD",
		)))
		storeTo := to
		if storeTo.IsZero() {
			storeTo = time.Now().Add(24 * time.Hour)
		}
		candles, storeErr := s.candleStore.GetRange(ctx, marketdatastore.CandleRangeQuery{
			InstrumentID:  instrument.ID,
			Symbol:        instrument.Symbol,
			AssetType:     string(instrument.AssetType),
			Interval:      interval,
			From:          from,
			To:            storeTo,
			QuoteCurrency: quoteCurrency,
			Limit:         limit,
		})
		if storeErr == nil && len(candles) > 0 {
			return &InstrumentCandlesResult{
				Candles:        candles,
				SourceProvider: "HYBRID",
				FallbackUsed:   false,
				Failures:       nil,
			}, nil
		}
		if storeErr != nil {
			log.Printf("[fetchCandlesByInstrument] hybrid store lookup failed for instrument %s: %v", instrument.ID, storeErr)
		}
	}

	result, err := s.fetchCandlesByInstrument(ctx, userID, instrument, interval, from, to, limit, preferredProvider)
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (s *marketDataService) GetRealTimePriceByInstrument(ctx context.Context, userID string, instrumentID string, preferredProvider *string) (*InstrumentCandlesResult, error) {
	to := time.Now()
	from := to.Add(-5 * time.Minute)

	result, err := s.GetCandlesByInstrument(ctx, userID, instrumentID, model.Interval1m, from, to, 1, preferredProvider)
	if err != nil {
		return nil, err
	}
	if len(result.Candles) == 0 {
		return nil, fmt.Errorf("no recent price data available")
	}

	result.Candles = []model.Candle{result.Candles[len(result.Candles)-1]}
	return result, nil
}

func (s *marketDataService) GetAvailableProviders(ctx context.Context, userID string, instrumentID string, dataType string) ([]AvailableProviderStatus, error) {
	if strings.TrimSpace(instrumentID) == "" {
		return nil, fmt.Errorf("instrumentId is required")
	}

	instrument, err := s.instrumentRepo.GetByID(ctx, instrumentID)
	if err != nil {
		return nil, err
	}

	credentials, err := s.credentialStateByProvider(ctx, userID)
	if err != nil {
		return nil, err
	}

	providersForAsset := s.providerManager.GetProvidersForAssetType(string(instrument.AssetType))
	statuses := make([]AvailableProviderStatus, 0, len(providersForAsset))

	for index, provider := range providersForAsset {
		providerID := strings.ToUpper(strings.TrimSpace(provider.ID()))
		caps := provider.Capabilities()

		mappingStatus := string(model.InstrumentProviderMappingStatusUnmapped)
		if mapping, mappingErr := s.mappingService.GetVerifiedMapping(ctx, instrumentID, providerID); mappingErr == nil && mapping != nil {
			mappingStatus = string(mapping.MappingStatus)
		} else {
			if _, deterministicErr := s.mappingService.EnsureDeterministicMapping(ctx, instrumentID, providerID); deterministicErr == nil {
				mappingStatus = string(model.InstrumentProviderMappingStatusVerified)
			}
		}

		cred := credentials[providerID]
		hasCredential := cred.present && strings.TrimSpace(cred.apiKey) != ""
		credentialValid := !caps.RequiresAPIKey || (cred.enabled && hasCredential)
		effectiveEnabled := (mappingStatus == string(model.InstrumentProviderMappingStatusVerified)) && (!caps.RequiresAPIKey || credentialValid)

		statuses = append(statuses, AvailableProviderStatus{
			Provider:         providerID,
			Capability:       supportsDataType(caps, dataType),
			RequiresAPIKey:   caps.RequiresAPIKey,
			HasCredential:    hasCredential,
			CredentialValid:  credentialValid,
			CredentialEnable: cred.enabled,
			Priority:         index + 1,
			MappingStatus:    mappingStatus,
			EffectiveEnabled: effectiveEnabled,
		})
	}

	return statuses, nil
}

func (s *marketDataService) ValidateProviderCredentials(ctx context.Context, userID string, providerID, apiKey string) error {
	if strings.EqualFold(strings.TrimSpace(providerID), "MARKETPARQUET") {
		if strings.TrimSpace(apiKey) == "" {
			return fmt.Errorf("api key is required")
		}
		return nil
	}
	provider, exists := s.providerManager.GetProvider(providerID)
	if !exists {
		return fmt.Errorf("unknown provider: %s", providerID)
	}

	return provider.ValidateCredentials(ctx, apiKey)
}

func (s *marketDataService) GetSupportedProviders(assetType string) []ProviderInfo {
	var providerList []providers.Provider
	if assetType == "" {
		providerList = s.providerManager.GetAllProviders()
	} else {
		providerList = s.providerManager.GetProvidersForAssetType(assetType)
	}

	info := make([]ProviderInfo, 0, len(providerList))
	for _, provider := range providerList {
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

	includeMarketParquet := assetType == ""
	if !includeMarketParquet {
		normalized := strings.ToUpper(strings.TrimSpace(assetType))
		includeMarketParquet = normalized == "STOCK" || normalized == "FUND"
	}
	if includeMarketParquet {
		info = append(info, ProviderInfo{
			ID:          "MARKETPARQUET",
			Name:        "MarketParquet",
			Type:        string(providers.ProviderTypeStock),
			RequiresKey: true,
			Intervals:   []string{string(model.Interval1d)},
			RateLimit: providers.RateLimit{
				RequestsPerMinute: 60,
				RequestsPerDay:    500,
			},
			SupportsRT: false,
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

		// Check if provider is in cooldown before any other checks
		if provider.IsInCooldown() {
			continue
		}

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
		return s.fetchAndStoreAssetPriceFromProvider(ctx, asset, nil)
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
	staleAssetIDs, staleErr := s.GetStaleAssetPrices(ctx, s.getMaxAgeForAssetType(model.AssetTypeCrypto))
	if staleErr != nil {
		log.Printf("[UpdateAssetPrices] WARNING: failed to compute stale asset count: %v", staleErr)
	} else {
		log.Printf("[UpdateAssetPrices] stale_tradeable_assets=%d", len(staleAssetIDs))
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

	assetIDStr := assetID.String()
	asset, err := s.assetRepo.GetByID(ctx, assetIDStr)
	if err != nil {
		return nil, fmt.Errorf("failed to get asset: %w", err)
	}

	if !asset.IsTradeable {
		return nil, fmt.Errorf("asset %s is not tradeable", asset.Name)
	}

	var instrument *model.Instrument
	if asset.InstrumentID != nil && strings.TrimSpace(*asset.InstrumentID) != "" && s.instrumentRepo != nil {
		instrument, err = s.instrumentRepo.GetByID(ctx, strings.TrimSpace(*asset.InstrumentID))
		if err != nil {
			return nil, fmt.Errorf("failed to get linked instrument %s for asset %s: %w", strings.TrimSpace(*asset.InstrumentID), asset.Name, err)
		}
	}

	return s.fetchAndStoreAssetPriceFromProvider(ctx, asset, instrument)
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
					log.Printf("[SchedulePriceUpdates] scheduled price update failed: %v", err)
				}
				cancel()
			case <-ctx.Done():
				log.Printf("[SchedulePriceUpdates] context canceled; stopping scheduler")
				s.StopPriceUpdates()
				return
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

type userCredentialState struct {
	present bool
	enabled bool
	apiKey  string
}

type providerExecutionTarget struct {
	provider providers.Provider
	mapping  *model.InstrumentProviderMapping
	apiKey   string
}

func (s *marketDataService) resolveInstrumentIDBySymbol(ctx context.Context, symbol string, assetType string) (string, error) {
	normalizedSymbol := strings.ToUpper(strings.TrimSpace(symbol))
	if normalizedSymbol == "" {
		return "", NewSymbolCompatibilityError(
			SymbolCompatibilityInvalidInput,
			"symbol is required",
			normalizedSymbol,
			assetType,
			nil,
		)
	}

	filter := repository.InstrumentSearchFilter{
		Limit:  3,
		Offset: 0,
	}
	if strings.TrimSpace(assetType) != "" {
		filter.AssetTypes = []model.InstrumentAssetType{model.InstrumentAssetType(strings.ToUpper(strings.TrimSpace(assetType)))}
	}

	rows, err := s.instrumentRepo.Search(ctx, normalizedSymbol, filter)
	if err != nil {
		return "", err
	}

	matches := make([]string, 0, len(rows))
	for _, row := range rows {
		if strings.EqualFold(strings.TrimSpace(row.Instrument.Symbol), normalizedSymbol) {
			matches = append(matches, row.Instrument.ID)
		}
	}

	if len(matches) == 1 {
		return matches[0], nil
	}
	if len(matches) > 1 {
		return "", NewSymbolCompatibilityError(
			SymbolCompatibilityAmbiguous,
			fmt.Sprintf("symbol %s maps to multiple instruments; use instrumentId", normalizedSymbol),
			normalizedSymbol,
			assetType,
			matches,
		)
	}

	return "", NewSymbolCompatibilityError(
		SymbolCompatibilityNotFound,
		fmt.Sprintf("no instrument found for symbol %s", normalizedSymbol),
		normalizedSymbol,
		assetType,
		nil,
	)
}

func (s *marketDataService) credentialStateByProvider(ctx context.Context, userID string) (map[string]userCredentialState, error) {
	state := make(map[string]userCredentialState)
	if strings.TrimSpace(userID) == "" {
		return state, nil
	}

	creds, err := s.credRepo.ListByUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	for _, cred := range creds {
		providerID := strings.ToUpper(strings.TrimSpace(cred.Provider))
		apiKey := strings.TrimSpace(cred.APIKey)
		if s.security != nil && apiKey != "" {
			if decrypted, decryptErr := s.security.DecryptString(apiKey); decryptErr == nil {
				apiKey = strings.TrimSpace(decrypted)
			}
		}
		state[providerID] = userCredentialState{
			present: true,
			enabled: cred.IsEnabled,
			apiKey:  apiKey,
		}
	}

	return state, nil
}

func (s *marketDataService) buildProviderExecutionPlan(ctx context.Context, userID string, instrument *model.Instrument, interval model.CandleInterval, preferredProvider *string) ([]providerExecutionTarget, []ProviderFailure, error) {
	if instrument == nil {
		return nil, nil, fmt.Errorf("instrument is required")
	}

	providerList := s.providerManager.GetProvidersForAssetType(string(instrument.AssetType))
	if len(providerList) == 0 {
		return nil, nil, fmt.Errorf("no providers configured for asset type %s", instrument.AssetType)
	}

	credentials, err := s.credentialStateByProvider(ctx, userID)
	if err != nil {
		return nil, nil, err
	}

	preferred := ""
	if preferredProvider != nil {
		preferred = strings.ToUpper(strings.TrimSpace(*preferredProvider))
	}

	targets := make([]providerExecutionTarget, 0, len(providerList))
	failures := make([]ProviderFailure, 0)

	appendTarget := func(provider providers.Provider) {
		providerID := strings.ToUpper(strings.TrimSpace(provider.ID()))
		caps := provider.Capabilities()

		supportsInterval := false
		for _, supportedInterval := range caps.Intervals {
			if supportedInterval == interval {
				supportsInterval = true
				break
			}
		}
		if !supportsInterval {
			failures = append(failures, ProviderFailure{Provider: providerID, Reason: "interval_not_supported"})
			return
		}

		mapping, mappingErr := s.mappingService.GetVerifiedMapping(ctx, instrument.ID, providerID)
		if mappingErr != nil {
			mapping, mappingErr = s.mappingService.EnsureDeterministicMapping(ctx, instrument.ID, providerID)
			if mappingErr == nil && mapping != nil {
				s.InvalidateRuntimeMarketDataCacheForInstrument(instrument.ID, RuntimeCacheInvalidationReasonMapping)
			}
		}
		if mappingErr != nil || mapping == nil || mapping.MappingStatus != model.InstrumentProviderMappingStatusVerified {
			failures = append(failures, ProviderFailure{Provider: providerID, Reason: "mapping_unresolved"})
			return
		}

		apiKey := ""
		if caps.RequiresAPIKey {
			credential, ok := credentials[providerID]
			if !ok || !credential.present || !credential.enabled {
				failures = append(failures, ProviderFailure{Provider: providerID, Reason: "credential_disabled_or_missing"})
				return
			}
			if strings.TrimSpace(credential.apiKey) == "" {
				failures = append(failures, ProviderFailure{Provider: providerID, Reason: "credential_empty"})
				return
			}
			apiKey = credential.apiKey
		}

		targets = append(targets, providerExecutionTarget{
			provider: provider,
			mapping:  mapping,
			apiKey:   apiKey,
		})
	}

	if preferred != "" {
		for _, provider := range providerList {
			if strings.EqualFold(provider.ID(), preferred) {
				appendTarget(provider)
				if len(targets) == 0 {
					return nil, failures, fmt.Errorf("preferred provider %s is not available for instrument %s", preferred, instrument.ID)
				}
				return targets, failures, nil
			}
		}
		return nil, failures, fmt.Errorf("unknown preferred provider %s", preferred)
	}

	for _, provider := range providerList {
		appendTarget(provider)
	}

	if len(targets) == 0 {
		return nil, failures, fmt.Errorf("no eligible providers for instrument %s", instrument.ID)
	}

	return targets, failures, nil
}

func (s *marketDataService) fetchCandlesByInstrument(ctx context.Context, userID string, instrument *model.Instrument, interval model.CandleInterval, from, to time.Time, limit int, preferredProvider *string) (*InstrumentCandlesResult, error) {
	if userID != "" && s.rateLimiter != nil {
		if err := s.rateLimiter.CheckRateLimit(ctx, fmt.Sprintf("candles:user:%s", userID), 60, time.Minute); err != nil {
			return nil, fmt.Errorf("rate limit exceeded: %w", err)
		}
	}

	cacheKey := s.runtimeMarketDataCacheKey(userID, instrument.ID, preferredProvider, "candles", interval, from, to, limit)
	if cached := s.getRuntimeCandlesCache(cacheKey); cached != nil {
		return cached, nil
	}

	targets, failures, err := s.buildProviderExecutionPlan(ctx, userID, instrument, interval, preferredProvider)
	if err != nil {
		return nil, err
	}

	for idx, target := range targets {
		caps := target.provider.Capabilities()
		providerID := strings.ToUpper(strings.TrimSpace(target.provider.ID()))

		if target.provider.IsInCooldown() {
			log.Printf("[fetchCandlesByInstrument] SKIP: Provider %s is in cooldown", providerID)
			failures = append(failures, ProviderFailure{Provider: providerID, Reason: "provider_in_cooldown"})
			continue
		}

		if s.rateLimiter != nil {
			rateLimitKey := fmt.Sprintf("provider:%s:user:%s:instrument:%s", providerID, userID, instrument.ID)
			if err := s.rateLimiter.CheckRateLimit(ctx, rateLimitKey, caps.RateLimit.RequestsPerMinute, time.Minute); err != nil {
				failures = append(failures, ProviderFailure{Provider: providerID, Reason: "provider_rate_limited"})
				continue
			}
		}

		symbol := strings.TrimSpace(firstNonEmpty(
			stringOrEmpty(target.mapping.ProviderSymbol),
			target.mapping.ProviderAssetID,
			instrument.Symbol,
		))

		response, providerErr := target.provider.GetCandles(ctx, providers.CandleRequest{
			Symbol:    symbol,
			AssetType: string(instrument.AssetType),
			Interval:  interval,
			From:      from,
			To:        to,
			Limit:     limit,
			APIKey:    target.apiKey,
		})
		if providerErr != nil {
			if !isTransientProviderError(providerErr) {
				failures = append(failures, ProviderFailure{Provider: providerID, Reason: providerErr.Error()})
				return nil, fmt.Errorf("provider %s failed: %w", providerID, providerErr)
			}
			failures = append(failures, ProviderFailure{Provider: providerID, Reason: providerErr.Error()})
			continue
		}

		if response == nil || len(response.Candles) == 0 {
			failures = append(failures, ProviderFailure{Provider: providerID, Reason: "empty_response"})
			continue
		}

		candles := s.sortAndDeduplicateCandles(response.Candles)
		quoteCurrency := strings.ToUpper(strings.TrimSpace(firstNonEmpty(
			stringOrEmpty(instrument.QuoteCurrency),
			stringOrEmpty(instrument.Currency),
			stringOrEmpty(target.mapping.QuoteCurrency),
			"USD",
		)))
		for i := range candles {
			candles[i].InstrumentID = &instrument.ID
			candles[i].QuoteCurrency = quoteCurrency
			if strings.TrimSpace(candles[i].Symbol) == "" {
				candles[i].Symbol = instrument.Symbol
			}
			if strings.TrimSpace(candles[i].AssetType) == "" {
				candles[i].AssetType = string(instrument.AssetType)
			}
		}
		if limit > 0 && len(candles) > limit {
			candles = candles[:limit]
		}
		if s.candleStore != nil {
			if err := s.candleStore.BulkUpsert(ctx, candles); err != nil {
				log.Printf("[fetchCandlesByInstrument] candle overlay upsert failed for instrument %s: %v", instrument.ID, err)
			}
		}

		result := &InstrumentCandlesResult{
			Candles:        candles,
			SourceProvider: providerID,
			FallbackUsed:   idx > 0,
			Failures:       failures,
		}
		s.setRuntimeCandlesCache(cacheKey, result, runtimeCandlesCacheTTL)
		return result, nil
	}

	return nil, fmt.Errorf("no mapped provider succeeded for instrument %s", instrument.ID)
}

const (
	runtimeCandlesCacheTTL        = 45 * time.Second
	runtimeCandlesCacheMaxEntries = 2000
)

func (s *marketDataService) runtimeMarketDataCacheKey(userID, instrumentID string, preferredProvider *string, dataType string, interval model.CandleInterval, from, to time.Time, limit int) string {
	provider := "AUTO"
	if preferredProvider != nil && strings.TrimSpace(*preferredProvider) != "" {
		provider = strings.ToUpper(strings.TrimSpace(*preferredProvider))
	}

	normalizedFrom, normalizedTo := normalizeCandleWindowForCache(interval, from, to)

	if strings.TrimSpace(userID) == "" {
		userID = "anonymous"
	}

	return fmt.Sprintf("md:v1:user:%s:instrument:%s:provider:%s:type:%s:interval:%s:from:%d:to:%d:limit:%d",
		userID,
		strings.TrimSpace(instrumentID),
		provider,
		strings.ToUpper(strings.TrimSpace(dataType)),
		strings.ToUpper(strings.TrimSpace(string(interval))),
		normalizedFrom.Unix(),
		normalizedTo.Unix(),
		limit,
	)
}

func normalizeCandleWindowForCache(interval model.CandleInterval, from, to time.Time) (time.Time, time.Time) {
	bucket := candleIntervalDuration(interval)
	if bucket <= 0 {
		bucket = time.Minute
	}

	normalizedFrom := time.Time{}
	normalizedTo := time.Time{}

	if !from.IsZero() {
		normalizedFrom = from.UTC().Truncate(bucket)
	}
	if !to.IsZero() {
		normalizedTo = to.UTC().Truncate(bucket)
	}

	return normalizedFrom, normalizedTo
}

func candleIntervalDuration(interval model.CandleInterval) time.Duration {
	switch interval {
	case model.Interval1m:
		return time.Minute
	case model.Interval5m:
		return 5 * time.Minute
	case model.Interval15m:
		return 15 * time.Minute
	case model.Interval30m:
		return 30 * time.Minute
	case model.Interval1h:
		return time.Hour
	case model.Interval4h:
		return 4 * time.Hour
	case model.Interval1d:
		return 24 * time.Hour
	default:
		return 0
	}
}

func (s *marketDataService) getRuntimeCandlesCache(cacheKey string) *InstrumentCandlesResult {
	s.runtimeCacheMu.RLock()
	entry, exists := s.runtimeCache[cacheKey]
	s.runtimeCacheMu.RUnlock()

	if !exists {
		return nil
	}
	if time.Now().After(entry.ExpiresAt) {
		s.runtimeCacheMu.Lock()
		delete(s.runtimeCache, cacheKey)
		s.runtimeCacheMu.Unlock()
		return nil
	}

	return cloneInstrumentCandlesResult(entry.Result)
}

func (s *marketDataService) setRuntimeCandlesCache(cacheKey string, result *InstrumentCandlesResult, ttl time.Duration) {
	if result == nil {
		return
	}
	if ttl <= 0 {
		ttl = runtimeCandlesCacheTTL
	}

	now := time.Now()

	s.runtimeCacheMu.Lock()
	defer s.runtimeCacheMu.Unlock()

	for key, entry := range s.runtimeCache {
		if now.After(entry.ExpiresAt) {
			delete(s.runtimeCache, key)
		}
	}

	if len(s.runtimeCache) >= runtimeCandlesCacheMaxEntries {
		for key := range s.runtimeCache {
			delete(s.runtimeCache, key)
			if len(s.runtimeCache) < runtimeCandlesCacheMaxEntries {
				break
			}
		}
	}

	s.runtimeCache[cacheKey] = &instrumentCandlesCacheEntry{
		Result:    cloneInstrumentCandlesResult(result),
		CachedAt:  now,
		ExpiresAt: now.Add(ttl),
	}
}

func (s *marketDataService) InvalidateRuntimeMarketDataCacheForUser(userID string, reason string) int {
	normalizedUserID := strings.TrimSpace(userID)
	if normalizedUserID == "" {
		return 0
	}

	marker := fmt.Sprintf("user:%s:", normalizedUserID)
	deleted := s.invalidateRuntimeCache(func(cacheKey string) bool {
		return strings.Contains(cacheKey, marker)
	})
	s.recordRuntimeCacheInvalidation("user", normalizedUserID, reason, deleted)
	return deleted
}

func (s *marketDataService) InvalidateRuntimeMarketDataCacheForInstrument(instrumentID string, reason string) int {
	normalizedInstrumentID := strings.TrimSpace(instrumentID)
	if normalizedInstrumentID == "" {
		return 0
	}

	marker := fmt.Sprintf("instrument:%s:", normalizedInstrumentID)
	deleted := s.invalidateRuntimeCache(func(cacheKey string) bool {
		return strings.Contains(cacheKey, marker)
	})
	s.recordRuntimeCacheInvalidation("instrument", normalizedInstrumentID, reason, deleted)
	return deleted
}

func (s *marketDataService) GetRuntimeMarketDataInvalidationStats() RuntimeMarketDataInvalidationStats {
	return RuntimeMarketDataInvalidationStats{
		TotalEvents:         atomic.LoadUint64(&s.runtimeInvalidationTotalEvents),
		TotalEntriesRemoved: atomic.LoadUint64(&s.runtimeInvalidationTotalEntriesRemoved),
		CredentialEvents:    atomic.LoadUint64(&s.runtimeInvalidationCredentialEvents),
		MappingEvents:       atomic.LoadUint64(&s.runtimeInvalidationMappingEvents),
		OtherEvents:         atomic.LoadUint64(&s.runtimeInvalidationOtherEvents),
	}
}

func (s *marketDataService) invalidateRuntimeCache(matchFn func(cacheKey string) bool) int {
	if matchFn == nil {
		return 0
	}

	deleted := 0
	s.runtimeCacheMu.Lock()
	defer s.runtimeCacheMu.Unlock()

	for cacheKey := range s.runtimeCache {
		if matchFn(cacheKey) {
			delete(s.runtimeCache, cacheKey)
			deleted++
		}
	}

	return deleted
}

func (s *marketDataService) recordRuntimeCacheInvalidation(scope string, identifier string, reason string, deleted int) {
	normalizedReason := strings.ToLower(strings.TrimSpace(reason))
	if normalizedReason == "" {
		normalizedReason = RuntimeCacheInvalidationReasonOther
	}

	atomic.AddUint64(&s.runtimeInvalidationTotalEvents, 1)
	if deleted > 0 {
		atomic.AddUint64(&s.runtimeInvalidationTotalEntriesRemoved, uint64(deleted))
	}

	switch normalizedReason {
	case RuntimeCacheInvalidationReasonCredential:
		atomic.AddUint64(&s.runtimeInvalidationCredentialEvents, 1)
	case RuntimeCacheInvalidationReasonMapping:
		atomic.AddUint64(&s.runtimeInvalidationMappingEvents, 1)
	default:
		atomic.AddUint64(&s.runtimeInvalidationOtherEvents, 1)
	}

	stats := s.GetRuntimeMarketDataInvalidationStats()
	log.Printf(
		"[runtime-candle-cache] invalidation scope=%s id=%s reason=%s removed=%d total_events=%d total_removed=%d credential_events=%d mapping_events=%d other_events=%d",
		scope,
		identifier,
		normalizedReason,
		deleted,
		stats.TotalEvents,
		stats.TotalEntriesRemoved,
		stats.CredentialEvents,
		stats.MappingEvents,
		stats.OtherEvents,
	)
}

func cloneInstrumentCandlesResult(input *InstrumentCandlesResult) *InstrumentCandlesResult {
	if input == nil {
		return nil
	}

	candles := make([]model.Candle, len(input.Candles))
	copy(candles, input.Candles)

	failures := make([]ProviderFailure, len(input.Failures))
	copy(failures, input.Failures)

	return &InstrumentCandlesResult{
		Candles:        candles,
		SourceProvider: input.SourceProvider,
		FallbackUsed:   input.FallbackUsed,
		Failures:       failures,
	}
}

func isTransientProviderError(err error) bool {
	if err == nil {
		return false
	}
	var providerErr *providers.ProviderError
	if errors.As(err, &providerErr) {
		return providerErr.Retryable || providerErr.Fallback
	}
	return strings.Contains(strings.ToLower(err.Error()), "timeout") || strings.Contains(strings.ToLower(err.Error()), "tempor")
}

func supportsDataType(caps providers.ProviderCapabilities, dataType string) bool {
	normalized := strings.ToUpper(strings.TrimSpace(dataType))
	if normalized == "" || normalized == "CANDLES" || normalized == "OHLCV" {
		return len(caps.Intervals) > 0
	}
	if normalized == "REALTIME" || normalized == "QUOTE" {
		return caps.SupportsRealtime || len(caps.Intervals) > 0
	}
	if normalized == "MARKET_CAP" {
		return true
	}
	return true
}

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

		// Check if provider is in cooldown
		if provider.IsInCooldown() {
			log.Printf("[fetchCandlesFromProviders] SKIP: Provider %s is in cooldown", provider.ID())
			continue
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

func resolveMappedQuoteSymbol(mapping *model.InstrumentProviderMapping, fallback string) string {
	if mapping == nil {
		return strings.TrimSpace(fallback)
	}
	return strings.TrimSpace(firstNonEmpty(
		stringOrEmpty(mapping.ProviderSymbol),
		mapping.ProviderAssetID,
		fallback,
	))
}

func (s *marketDataService) resolveProviderQuoteSymbolForInstrument(ctx context.Context, instrument *model.Instrument, providerID string) (string, *model.InstrumentProviderMapping, error) {
	if instrument == nil {
		return "", nil, fmt.Errorf("instrument is required")
	}

	if s.mappingService == nil {
		return "", nil, fmt.Errorf("mapping service is not configured")
	}

	normalizedProviderID := strings.ToUpper(strings.TrimSpace(providerID))
	mapping, mappingErr := s.mappingService.GetVerifiedMapping(ctx, instrument.ID, normalizedProviderID)
	if mappingErr != nil {
		mapping, mappingErr = s.mappingService.EnsureDeterministicMapping(ctx, instrument.ID, normalizedProviderID)
		if mappingErr == nil && mapping != nil {
			s.InvalidateRuntimeMarketDataCacheForInstrument(instrument.ID, RuntimeCacheInvalidationReasonMapping)
		}
	}
	if mappingErr != nil || mapping == nil || mapping.MappingStatus != model.InstrumentProviderMappingStatusVerified {
		status := "MISSING"
		if mapping != nil && mapping.MappingStatus != "" {
			status = string(mapping.MappingStatus)
		}
		if mappingErr != nil {
			return "", nil, fmt.Errorf("verified mapping unavailable for instrument %s and provider %s (status=%s): %w", instrument.ID, normalizedProviderID, status, mappingErr)
		}
		return "", nil, fmt.Errorf("verified mapping unavailable for instrument %s and provider %s (status=%s)", instrument.ID, normalizedProviderID, status)
	}

	symbol := resolveMappedQuoteSymbol(mapping, instrument.Symbol)
	if symbol == "" {
		return "", nil, fmt.Errorf("mapped symbol is empty for instrument %s and provider %s", instrument.ID, normalizedProviderID)
	}

	return symbol, mapping, nil
}

// fetchAndStoreAssetPriceFromProvider fetches price from external source and stores it
func (s *marketDataService) fetchAndStoreAssetPriceFromProvider(ctx context.Context, asset *model.Asset, instrument *model.Instrument) (*AssetPriceData, error) {
	rawSymbol := ""
	if asset.Symbol != nil {
		rawSymbol = strings.TrimSpace(*asset.Symbol)
	}
	hasLinkedInstrument := instrument != nil && strings.TrimSpace(instrument.ID) != ""
	assetSymbolForLogs := rawSymbol
	if assetSymbolForLogs == "" && instrument != nil {
		assetSymbolForLogs = strings.TrimSpace(instrument.Symbol)
	}
	if !hasLinkedInstrument && rawSymbol == "" {
		log.Printf("[fetchAndStoreAssetPriceFromProvider] ERROR: Asset '%s' (ID: %s) has no symbol and no linked instrument mapping", asset.Name, asset.ID)
		return nil, fmt.Errorf("asset symbol is required for legacy assets without linked instrument mapping")
	}

	log.Printf("[fetchAndStoreAssetPriceFromProvider] Fetching price for asset '%s' (Symbol: %s, Type: %s, linked_instrument=%v)", asset.Name, rawSymbol, asset.Type, hasLinkedInstrument)

	// Try to get system-wide credentials first (admin-set for all users)
	credMap := make(map[string]string)

	systemCreds, err := s.credRepo.ListSystemWide(ctx)
	if err != nil {
		log.Printf("[fetchAndStoreAssetPriceFromProvider] WARNING: Failed to get system-wide credentials: %v", err)
	}

	if len(systemCreds) == 0 {
		log.Printf("[fetchAndStoreAssetPriceFromProvider] No system-wide API keys configured; only no-key providers can be used.")
	} else {
		log.Printf("[fetchAndStoreAssetPriceFromProvider] Found %d credentials to try", len(systemCreds))
	}

	decryptFailureCount := 0
	usableCredentialCount := 0
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
			decryptFailureCount++
			log.Printf("[fetchAndStoreAssetPriceFromProvider] CRITICAL: Could not decrypt API key for %s (tried both methods). Key stored with different ENCRYPTION_KEY. Skipping provider.", cred.Provider)
			continue
		}

		credMap[cred.Provider] = apiKey
		usableCredentialCount++
		log.Printf("[fetchAndStoreAssetPriceFromProvider] Using API key for provider: %s", cred.Provider)
	}
	if decryptFailureCount > 0 {
		log.Printf("[fetchAndStoreAssetPriceFromProvider] credential_decrypt_failures=%d", decryptFailureCount)
	}
	log.Printf("[fetchAndStoreAssetPriceFromProvider] usable_system_credentials=%d", usableCredentialCount)

	// Determine canonical quote currency from instrument (or default to USD).
	// This stays consistent across provider fallbacks so logs always show the
	// instrument's native quote currency, not per-provider-mapping currencies.
	canonicalQuoteCurrency := "USD"
	if hasLinkedInstrument {
		canonicalQuoteCurrency = strings.ToUpper(strings.TrimSpace(firstNonEmpty(
			stringOrEmpty(instrument.QuoteCurrency),
			stringOrEmpty(instrument.Currency),
			"USD",
		)))
	}

	// Get providers for this asset type
	providerList := s.providerManager.GetProvidersForAssetType(string(asset.Type))
	log.Printf("[fetchAndStoreAssetPriceFromProvider] Found %d providers for asset type %s", len(providerList), asset.Type)

	var lastError error
	providerSuccessCount := 0
	providerFailureCount := 0
	for _, provider := range providerList {
		caps := provider.Capabilities()
		providerID := strings.ToUpper(strings.TrimSpace(provider.ID()))

		// Check if provider is in cooldown
		if provider.IsInCooldown() {
			log.Printf("[fetchAndStoreAssetPriceFromProvider] SKIP: Provider %s is in cooldown", providerID)
			lastError = fmt.Errorf("provider %s is in cooldown", providerID)
			continue
		}

		requestSymbol := rawSymbol
		var mapping *model.InstrumentProviderMapping
		if hasLinkedInstrument {
			var mappingErr error
			requestSymbol, mapping, mappingErr = s.resolveProviderQuoteSymbolForInstrument(ctx, instrument, providerID)
			if mappingErr != nil {
				log.Printf("[fetchAndStoreAssetPriceFromProvider] SKIP: Provider %s missing linked mapping for instrument %s: %v", providerID, instrument.ID, mappingErr)
				lastError = mappingErr
				continue
			}
		}

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
			Symbol:    requestSymbol,
			AssetType: string(asset.Type),
			APIKey:    apiKey,
		}

		mappedProviderIdentity := ""
		if mapping != nil {
			mappedProviderIdentity = firstNonEmpty(stringOrEmpty(mapping.ProviderSymbol), mapping.ProviderAssetID)
		}

		log.Printf(
			"[fetchAndStoreAssetPriceFromProvider] Calling provider %s with symbol=%s provider_asset_id=%s quote_currency=%s",
			provider.ID(),
			requestSymbol,
			mappedProviderIdentity,
			canonicalQuoteCurrency,
		)

		quoteResp, err := provider.GetQuote(ctx, quoteReq)
		if err != nil {
			providerFailureCount++
			log.Printf("[fetchAndStoreAssetPriceFromProvider] Provider %s GetQuote error: %v", provider.ID(), err)
			lastError = err
		} else if quoteResp != nil {
			log.Printf("[fetchAndStoreAssetPriceFromProvider] Provider %s returned price: %s", provider.ID(), quoteResp.Last.String())
		}
		if err == nil && quoteResp != nil && !quoteResp.Last.IsZero() {
			log.Printf("[fetchAndStoreAssetPriceFromProvider] Price timestamp from %s: %s", provider.ID(), quoteResp.Timestamp.String())
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
				log.Printf("[fetchAndStoreAssetPriceFromProvider] Validation failed for %s: %v - trying other providers", requestSymbol, err)
			} else {
				// Store in database
				if _, err := s.priceRepo.Create(ctx, assetPrice); err != nil {
					// Try direct insert into partition table
					partitionErr := s.tryDirectPartitionInsert(ctx, assetPrice)
					if partitionErr != nil {
						log.Printf("[fetchAndStoreAssetPriceFromProvider] DB store failed for %s: %v, partition insert also failed: %v", requestSymbol, err, partitionErr)
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
						log.Printf("[fetchAndStoreAssetPriceFromProvider] SUCCESS: Stored price %s for asset %s via partition", quoteResp.Last.String(), requestSymbol)
						s.assetPriceCache.Set(assetUUID, priceData, 5*time.Minute)
						providerSuccessCount++
						log.Printf("[fetchAndStoreAssetPriceFromProvider] provider_successes=%d provider_failures=%d", providerSuccessCount, providerFailureCount)
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

					log.Printf("[fetchAndStoreAssetPriceFromProvider] SUCCESS: Stored price %s for asset %s", quoteResp.Last.String(), requestSymbol)
					s.assetPriceCache.Set(assetUUID, priceData, 5*time.Minute)
					providerSuccessCount++
					log.Printf("[fetchAndStoreAssetPriceFromProvider] provider_successes=%d provider_failures=%d", providerSuccessCount, providerFailureCount)
					return priceData, nil
				}
			}
		}

		now := time.Now()
		req := providers.CandleRequest{
			Symbol:    requestSymbol,
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
			providerFailureCount++
			continue
		}

		candle := response.Candles[len(response.Candles)-1]
		price := candle.Close

		assetPrice := &model.AssetPrice{
			AssetID:   asset.ID,
			Price:     price,
			Timestamp: candle.Timestamp,
			Source:    candle.Source,
		}

		if candle.Volume.IsPositive() {
			volume := candle.Volume.IntPart()
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
		providerSuccessCount++
		log.Printf("[fetchAndStoreAssetPriceFromProvider] provider_successes=%d provider_failures=%d", providerSuccessCount, providerFailureCount)
		return priceData, nil
	}

	log.Printf("[fetchAndStoreAssetPriceFromProvider] provider_successes=%d provider_failures=%d", providerSuccessCount, providerFailureCount)
	if lastError != nil {
		log.Printf("[fetchAndStoreAssetPriceFromProvider] ERROR: All providers failed for %s %s. Last error: %v", asset.Type, assetSymbolForLogs, lastError)
		return nil, fmt.Errorf("no providers returned data for %s %s: %w", asset.Type, assetSymbolForLogs, lastError)
	}
	return nil, fmt.Errorf("no providers returned data for %s %s", asset.Type, assetSymbolForLogs)
}

// updateAssetsFromProvider updates prices for a group of assets from the same provider
func (s *marketDataService) updateAssetsFromProvider(ctx context.Context, assets []model.Asset, sourceName string) error {
	// For now, update assets individually since we're reusing the candle infrastructure
	// This could be optimized later with batch requests
	successCount := 0
	for _, asset := range assets {
		var instrument *model.Instrument
		if asset.InstrumentID != nil && strings.TrimSpace(*asset.InstrumentID) != "" && s.instrumentRepo != nil {
			linkedInstrument, err := s.instrumentRepo.GetByID(ctx, strings.TrimSpace(*asset.InstrumentID))
			if err != nil {
				log.Printf("[updateAssetsFromProvider] SKIP: linked instrument lookup failed for asset %s: %v", asset.Name, err)
				continue
			}
			instrument = linkedInstrument
		}

		hasRawSymbol := asset.Symbol != nil && strings.TrimSpace(*asset.Symbol) != ""
		if !hasRawSymbol && instrument == nil {
			log.Printf("[updateAssetsFromProvider] SKIP: Asset '%s' has no symbol and no linked instrument", asset.Name)
			continue
		}

		_, err := s.fetchAndStoreAssetPriceFromProvider(ctx, &asset, instrument)
		if err != nil {
			// Log error but continue with other assets
			log.Printf("[updateAssetsFromProvider] Failed to update price for asset %s: %v", asset.Name, err)
			continue
		}
		successCount++
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
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT (asset_id, timestamp) DO NOTHING
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

// BackfillAssetPrices fetches historical daily prices for an asset and inserts them into asset_prices
func (s *marketDataService) BackfillAssetPrices(ctx context.Context, userID string, assetID uuid.UUID, instrumentID string, from, to time.Time) (*HistoricalBackfillOutcome, error) {
	if assetID == uuid.Nil {
		return nil, fmt.Errorf("asset ID is required")
	}
	if strings.TrimSpace(instrumentID) == "" {
		return nil, fmt.Errorf("instrument ID is required")
	}

	instrument, err := s.instrumentRepo.GetByID(ctx, instrumentID)
	if err != nil {
		return nil, &HistoricalBackfillError{
			Code:     "INSTRUMENT_NOT_FOUND",
			Provider: "YFINANCE",
			Message:  fmt.Sprintf("failed to load instrument %s for yfinance historical backfill", instrumentID),
			Err:      err,
		}
	}
	if instrument == nil {
		return nil, &HistoricalBackfillError{
			Code:     "INSTRUMENT_NOT_FOUND",
			Provider: "YFINANCE",
			Message:  fmt.Sprintf("instrument %s was not found for yfinance historical backfill", instrumentID),
		}
	}

	provider, ok := s.providerManager.GetProvider("YFINANCE")
	if !ok {
		return nil, &HistoricalBackfillError{
			Code:     "YFINANCE_UNAVAILABLE",
			Provider: "YFINANCE",
			Message:  "Yahoo Finance historical backfill provider is not registered; check YFINANCE_HOST/YFINANCE_PORT and sidecar startup",
		}
	}

	providerSymbol, err := s.resolveYFinanceBackfillSymbol(ctx, provider, instrument)
	if err != nil {
		return nil, err
	}

	requestedFrom := normalizeUTCDate(from)
	requestedTo := normalizeUTCDate(to)
	if requestedTo.Before(requestedFrom) {
		requestedTo = requestedFrom
	}

	existing, err := s.priceRepo.GetPriceHistory(ctx, assetID.String(), repository.TimeRange{
		Start: requestedFrom,
		End:   requestedTo.Add(24*time.Hour - time.Nanosecond),
	})
	if err != nil {
		return nil, &HistoricalBackfillError{
			Code:     "BACKFILL_READ_FAILED",
			Provider: provider.ID(),
			Symbol:   providerSymbol,
			Message:  "failed to inspect existing historical prices before backfill",
			Err:      err,
		}
	}
	missingWindows := buildMissingBackfillWindows(requestedFrom, requestedTo, existing, model.AssetType(instrument.AssetType))
	outcome := &HistoricalBackfillOutcome{
		RequestedFrom:  requestedFrom,
		RequestedTo:    requestedTo,
		FetchedWindows: len(missingWindows),
		ProviderSymbol: providerSymbol,
	}
	if len(missingWindows) == 0 {
		outcome.SkippedAsCovered = true
		log.Printf("[BackfillAssetPrices] skipping fetch asset=%s instrument=%s symbol=%s from=%s to=%s reason=already_covered", assetID, instrumentID, providerSymbol, requestedFrom.Format(time.DateOnly), requestedTo.Format(time.DateOnly))
		return outcome, nil
	}

	pricesByTimestamp := make(map[time.Time]model.AssetPrice, len(existing))
	for _, price := range existing {
		pricesByTimestamp[price.Timestamp.UTC()] = price
	}
	toUpsert := make([]model.AssetPrice, 0, 512)
	var firstAffected *time.Time
	var lastAffected *time.Time
	var returnedAnyCandles bool

	for _, window := range missingWindows {
		fetchFrom := window.Start
		fetchTo := window.End.AddDate(0, 0, 1) // yfinance end is exclusive
		resp, fetchErr := provider.GetCandles(ctx, providers.CandleRequest{
			Symbol:    providerSymbol,
			AssetType: string(instrument.AssetType),
			Interval:  model.Interval1d,
			From:      fetchFrom,
			To:        fetchTo,
			Limit:     5000,
		})
		if fetchErr != nil {
			code := "HISTORY_FETCH_FAILED"
			if isYFinanceSymbolNotFound(fetchErr) {
				code = "YFINANCE_SYMBOL_NOT_FOUND"
			}
			log.Printf("[BackfillAssetPrices] yfinance history fetch failed asset=%s instrument=%s symbol=%s code=%s err=%v", assetID, instrumentID, providerSymbol, code, fetchErr)
			return nil, &HistoricalBackfillError{
				Code:     code,
				Provider: provider.ID(),
				Symbol:   providerSymbol,
				Message:  fmt.Sprintf("failed to fetch Yahoo Finance history for symbol %s", providerSymbol),
				Err:      fetchErr,
			}
		}

		candles := []model.Candle(nil)
		if resp != nil {
			candles = resp.Candles
		}
		if len(candles) == 0 {
			if fetchTo.Sub(fetchFrom) <= 72*time.Hour {
				log.Printf("[BackfillAssetPrices] no candles for narrow window asset=%s symbol=%s from=%s to=%s", assetID, providerSymbol, fetchFrom.Format(time.RFC3339), fetchTo.Format(time.RFC3339))
				continue
			}
			log.Printf("[BackfillAssetPrices] empty window asset=%s symbol=%s from=%s to=%s", assetID, providerSymbol, fetchFrom.Format(time.DateOnly), window.End.Format(time.DateOnly))
			continue
		}
		returnedAnyCandles = true

		for _, candle := range candles {
			candidate := model.AssetPrice{
				AssetID:   assetID.String(),
				Price:     candle.Close,
				Timestamp: candle.Timestamp.UTC(),
				Source:    provider.ID(),
			}
			if candle.Volume.IsPositive() {
				vol := candle.Volume.IntPart()
				candidate.Volume = &vol
			}
			existingPrice, exists := pricesByTimestamp[candidate.Timestamp]
			if exists && assetPriceEquals(existingPrice, candidate) {
				outcome.RowsSkipped++
				continue
			}
			if exists {
				outcome.RowsUpdated++
			} else {
				outcome.RowsInserted++
			}
			pricesByTimestamp[candidate.Timestamp] = candidate
			toUpsert = append(toUpsert, candidate)
			ts := candidate.Timestamp
			if firstAffected == nil || ts.Before(*firstAffected) {
				firstAffected = &ts
			}
			if lastAffected == nil || ts.After(*lastAffected) {
				lastAffected = &ts
			}
		}
	}

	if !returnedAnyCandles {
		outcome.RowsSkipped = len(missingWindows)
		return outcome, nil
	}

	if len(toUpsert) == 0 {
		outcome.SkippedAsCovered = true
		return outcome, nil
	}

	if err := s.priceRepo.UpsertPrices(ctx, toUpsert); err != nil {
		return nil, &HistoricalBackfillError{
			Code:     "BACKFILL_WRITE_FAILED",
			Provider: provider.ID(),
			Symbol:   providerSymbol,
			Message:  "failed to store Yahoo Finance historical prices",
			Err:      err,
		}
	}

	outcome.RowsTouched = len(toUpsert)
	outcome.AffectedFrom = firstAffected
	outcome.AffectedTo = lastAffected
	log.Printf("[BackfillAssetPrices] Successfully backfilled %d changed prices for asset %s symbol=%s from %s to %s windows=%d", len(toUpsert), assetID, providerSymbol, requestedFrom.Format(time.DateOnly), requestedTo.Format(time.DateOnly), len(missingWindows))
	return outcome, nil
}

type backfillWindow struct {
	Start time.Time
	End   time.Time
}

func buildMissingBackfillWindows(from, to time.Time, existing []model.AssetPrice, assetType model.AssetType) []backfillWindow {
	from = normalizeUTCDate(from)
	to = normalizeUTCDate(to)
	if to.Before(from) {
		return nil
	}
	if len(existing) == 0 {
		return []backfillWindow{{Start: from, End: to}}
	}

	days := make([]time.Time, 0, len(existing))
	seen := make(map[time.Time]struct{}, len(existing))
	for _, price := range existing {
		day := normalizeUTCDate(price.Timestamp)
		if day.Before(from) || day.After(to) {
			continue
		}
		if _, ok := seen[day]; ok {
			continue
		}
		seen[day] = struct{}{}
		days = append(days, day)
	}
	if len(days) == 0 {
		return []backfillWindow{{Start: from, End: to}}
	}
	sort.Slice(days, func(i, j int) bool { return days[i].Before(days[j]) })

	maxNaturalGap := 4
	if assetType == model.AssetTypeCrypto {
		maxNaturalGap = 1
	}

	windows := make([]backfillWindow, 0, 4)
	if from.Before(days[0]) {
		windows = append(windows, backfillWindow{Start: from, End: days[0].AddDate(0, 0, -1)})
	}
	for i := 1; i < len(days); i++ {
		gapDays := int(days[i].Sub(days[i-1]).Hours() / 24)
		if gapDays <= maxNaturalGap {
			continue
		}
		start := days[i-1].AddDate(0, 0, 1)
		end := days[i].AddDate(0, 0, -1)
		if !end.Before(start) {
			windows = append(windows, backfillWindow{Start: start, End: end})
		}
	}
	if days[len(days)-1].Before(to) {
		windows = append(windows, backfillWindow{Start: days[len(days)-1].AddDate(0, 0, 1), End: to})
	}
	return windows
}

func normalizeUTCDate(value time.Time) time.Time {
	utc := value.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

func assetPriceEquals(existing model.AssetPrice, candidate model.AssetPrice) bool {
	if !existing.Price.Equal(candidate.Price) {
		return false
	}
	if existing.Source != candidate.Source {
		return false
	}
	if !nullableInt64Equal(existing.Volume, candidate.Volume) {
		return false
	}
	return nullableInt64Equal(existing.MarketCap, candidate.MarketCap)
}

func nullableInt64Equal(left, right *int64) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

func (s *marketDataService) resolveYFinanceBackfillSymbol(ctx context.Context, provider providers.Provider, instrument *model.Instrument) (string, error) {
	rawSymbol := ""
	if s.mappingService != nil {
		if mapping, err := s.mappingService.GetVerifiedMapping(ctx, instrument.ID, "YFINANCE"); err == nil && mapping != nil {
			rawSymbol = resolveMappedQuoteSymbol(mapping, "")
		} else if err != nil && !errors.Is(err, repository.ErrNotFound) {
			log.Printf("[BackfillAssetPrices] yfinance mapping lookup failed instrument=%s err=%v", instrument.ID, err)
		}
	}
	if rawSymbol == "" && instrument.ProviderExternalID != nil {
		candidate := strings.TrimSpace(*instrument.ProviderExternalID)
		if !isGenericBackfillSymbol(candidate) {
			rawSymbol = candidate
		}
	}
	if rawSymbol == "" {
		rawSymbol = strings.TrimSpace(instrument.Symbol)
	}
	if isGenericBackfillSymbol(rawSymbol) {
		rawSymbol = strings.TrimSpace(instrument.Symbol)
	}
	if rawSymbol == "" {
		return "", &HistoricalBackfillError{
			Code:     "YFINANCE_SYMBOL_NOT_FOUND",
			Provider: "YFINANCE",
			Message:  fmt.Sprintf("instrument %s has no symbol for Yahoo Finance historical backfill", instrument.ID),
		}
	}

	providerSymbol, err := provider.MapSymbol(rawSymbol, string(instrument.AssetType))
	if err != nil {
		return "", &HistoricalBackfillError{
			Code:     "YFINANCE_SYMBOL_NOT_FOUND",
			Provider: provider.ID(),
			Symbol:   rawSymbol,
			Message:  fmt.Sprintf("failed to map instrument symbol %s for Yahoo Finance", rawSymbol),
			Err:      err,
		}
	}
	providerSymbol = strings.TrimSpace(providerSymbol)
	if providerSymbol == "" {
		return "", &HistoricalBackfillError{
			Code:     "YFINANCE_SYMBOL_NOT_FOUND",
			Provider: provider.ID(),
			Symbol:   rawSymbol,
			Message:  fmt.Sprintf("instrument symbol %s mapped to an empty Yahoo Finance symbol", rawSymbol),
		}
	}
	return providerSymbol, nil
}

func isGenericBackfillSymbol(symbol string) bool {
	normalized := strings.ToUpper(strings.TrimSpace(symbol))
	if normalized == "" {
		return true
	}
	switch normalized {
	case "EQUITIES", "EQUITY", "STOCK", "STOCKS", "FUND", "FUNDS", "ETF", "ETFS", "CRYPTO", "CRYPTOCURRENCY":
		return true
	default:
		return false
	}
}

func isYFinanceSymbolNotFound(err error) bool {
	if err == nil {
		return false
	}
	var providerErr *providers.ProviderError
	if errors.As(err, &providerErr) {
		msg := strings.ToLower(providerErr.Message + " " + providerErr.Code)
		if strings.Contains(msg, "not found") || strings.Contains(msg, "no history data found") || strings.Contains(msg, "no price data found") {
			return true
		}
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "not found") ||
		strings.Contains(msg, "no history data found") ||
		strings.Contains(msg, "no price data found")
}
