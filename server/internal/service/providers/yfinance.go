package providers

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"sigma_finance/internal/domain/model"
	pb "sigma_finance/internal/handler/grpc/pb"
	grpc "sigma_finance/internal/infrastructure/grpc"

	"github.com/shopspring/decimal"
	"github.com/sony/gobreaker"
	"golang.org/x/time/rate"
	gcodes "google.golang.org/grpc/codes"
	gstatus "google.golang.org/grpc/status"
)

// Cache TTLs
const (
	priceCacheTTL   = 60 * time.Second // 60 seconds for prices
	historyCacheTTL = 5 * time.Minute  // 5 minutes for historical data
	infoCacheTTL    = 24 * time.Hour   // 24 hours for company info
)

// cacheEntry holds a cached value with its expiration time.
type cacheEntry struct {
	value     any
	expiresAt time.Time
}

// cache is a thread-safe in-memory cache with TTL support.
type cache struct {
	mu    sync.RWMutex
	items map[string]*cacheEntry
}

// newCache creates a new cache instance.
func newCache() *cache {
	return &cache{
		items: make(map[string]*cacheEntry),
	}
}

func (c *cache) get(key string) (any, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.items[key]
	if !ok {
		return nil, false
	}
	if time.Now().After(entry.expiresAt) {
		return nil, false
	}
	return entry.value, true
}

func (c *cache) set(key string, value any, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.items[key] = &cacheEntry{
		value:     value,
		expiresAt: time.Now().Add(ttl),
	}
}

func (c *cache) delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.items, key)
}

func (c *cache) cleanup() {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	for key, entry := range c.items {
		if now.After(entry.expiresAt) {
			delete(c.items, key)
		}
	}
}

// YFinanceConfig holds configuration for the YFinance provider.
type YFinanceConfig struct {
	Host string // Hostname or IP of the yfinance sidecar (e.g. "yfinance-service" or "localhost")
	Port string // Port of the yfinance sidecar (e.g. "50051")
}

// YFinanceProvider implements Provider for Yahoo Finance via gRPC.
// YFinance is a Python sidecar service that wraps the yfinance library.
type YFinanceProvider struct {
	client       *grpc.MarketDataClient
	host         string
	port         string
	cb           *gobreaker.CircuitBreaker
	limiter      *rate.Limiter
	priceCache   *cache
	historyCache *cache
	infoCache    *cache
	stopCleanup  chan struct{}
	CooldownMixin
}

// NewYFinanceProvider creates a new YFinance provider with lazy gRPC connection.
// The actual connection is established on first use via sync.Once.
func NewYFinanceProvider(cfg YFinanceConfig) (*YFinanceProvider, error) {
	if cfg.Host == "" {
		return nil, fmt.Errorf("yfinance host cannot be empty")
	}
	if cfg.Port == "" {
		return nil, fmt.Errorf("yfinance port cannot be empty")
	}

	cb := gobreaker.NewCircuitBreaker(gobreaker.Settings{
		Name:        "yfinance",
		MaxRequests: 3,
		Interval:    10 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.TotalFailures >= 5 && failureRatio >= 0.6
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			log.Printf("[ERROR] YFinance circuit breaker: %s -> %s", from, to)
		},
	})

	// Rate limit: 1800 requests/hour (0.5 per second) to stay under yfinance limit
	limiter := rate.NewLimiter(rate.Limit(0.5), 2)

	client, err := grpc.NewMarketDataClient(cfg.Host, cfg.Port)
	if err != nil {
		return nil, fmt.Errorf("failed to create yfinance client: %w", err)
	}

	provider := &YFinanceProvider{
		client:        client,
		host:          cfg.Host,
		port:          cfg.Port,
		cb:            cb,
		limiter:       limiter,
		priceCache:    newCache(),
		historyCache:  newCache(),
		infoCache:     newCache(),
		stopCleanup:   make(chan struct{}),
		CooldownMixin: NewCooldownMixin(DefaultRetryAfterMax),
	}

	// Start background cache cleanup goroutine
	go provider.cleanupCaches()

	return provider, nil
}

func (y *YFinanceProvider) ID() string { return "YFINANCE" }

func (y *YFinanceProvider) Name() string { return "Yahoo Finance" }

func (y *YFinanceProvider) Type() ProviderType { return ProviderTypeStock }

func (y *YFinanceProvider) Capabilities() ProviderCapabilities {
	return ProviderCapabilities{
		Intervals: []model.CandleInterval{
			model.Interval1m,
			model.Interval5m,
			model.Interval15m,
			model.Interval30m,
			model.Interval1h,
			model.Interval4h,
			model.Interval1d,
		},
		MaxHistoryDays:   365 * 5, // YFinance has ~5 years of history
		SupportsRealtime: false,
		RequiresAPIKey:   false, // YFinance is public data
		RateLimit: RateLimit{
			RequestsPerMinute: 60,
			RequestsPerDay:    -1, // No daily limit
			BurstLimit:        5,
		},
		AssetTypes: []string{"STOCK", "FUND", "CRYPTO", "ETF", "INDEX"},
	}
}

// MapSymbol converts internal symbol format to YFinance format.
// YFinance uses standard ticker symbols (e.g., "AAPL", "MSFT").
// For funds/ETFs, it may use "SYMBOL" format.
func (y *YFinanceProvider) MapSymbol(internalSymbol, assetType string) (string, error) {
	symbol := strings.ToUpper(strings.TrimSpace(internalSymbol))

	switch assetType {
	case "STOCK", "FUND", "ETF", "INDEX":
		// Remove exchange suffixes (e.g., "AAPL:US" -> "AAPL", "^SPX:INDICES" -> "^SPX")
		if strings.Contains(symbol, ":") {
			parts := strings.Split(symbol, ":")
			symbol = parts[0]
		}
		return symbol, nil
	case "CRYPTO":
		// YFinance uses "-" separator for crypto (e.g., "BTC-USD")
		sym := strings.ReplaceAll(symbol, "/", "-")
		if !strings.Contains(sym, "-") && !strings.HasSuffix(sym, "USD") && !strings.HasSuffix(sym, "USDT") && !strings.HasSuffix(sym, "EUR") {
			sym = sym + "-USD"
		}
		return sym, nil
	default:
		return symbol, nil
	}
}

// NormalizeSymbol converts YFinance symbol format back to internal format.
func (y *YFinanceProvider) NormalizeSymbol(providerSymbol, assetType string) (string, error) {
	symbol := strings.ToUpper(providerSymbol)
	return symbol, nil
}

// mapInterval converts internal interval to YFinance format.
func (y *YFinanceProvider) mapInterval(interval model.CandleInterval) pb.Interval {
	switch strings.ToLower(string(interval)) {
	case "1m":
		return pb.Interval_INTERVAL_1M
	case "5m":
		return pb.Interval_INTERVAL_5M
	case "15m":
		return pb.Interval_INTERVAL_15M
	case "30m":
		return pb.Interval_INTERVAL_30M
	case "1h":
		return pb.Interval_INTERVAL_1H
	case "4h":
		return pb.Interval_INTERVAL_4H
	case "1d", "1day", "d", "day":
		return pb.Interval_INTERVAL_1D
	case "1w", "1wk", "w", "week":
		return pb.Interval_INTERVAL_1D
	case "1mo", "1mth", "mo", "month":
		return pb.Interval_INTERVAL_1D
	default:
		return pb.Interval_INTERVAL_1D
	}
}

// mapAssetType converts internal asset type to protobuf asset type.
//
// All asset types use dedicated enum values from proto/market_data.proto
// (ASSET_TYPE_ETF = 4, ASSET_TYPE_INDEX = 5).  The Python yfinance sidecar
// MUST be regenerated alongside the proto change — see the REGEN NOTE on
// the AssetType enum in proto/market_data.proto.  Until the Python
// sidecar is regenerated, ETF/INDEX fetches over gRPC will fall through
// the sidecar's UNSPECIFIED path and may mis-classify the asset type on
// the Python side.
func (y *YFinanceProvider) mapAssetType(assetType string) pb.AssetType {
	switch assetType {
	case "STOCK":
		return pb.AssetType_ASSET_TYPE_STOCK
	case "ETF":
		return pb.AssetType_ASSET_TYPE_ETF
	case "FUND":
		return pb.AssetType_ASSET_TYPE_FUND
	case "CRYPTO":
		return pb.AssetType_ASSET_TYPE_CRYPTO
	case "INDEX":
		return pb.AssetType_ASSET_TYPE_INDEX
	default:
		return pb.AssetType_ASSET_TYPE_UNSPECIFIED
	}
}

func (y *YFinanceProvider) periodFromInterval(interval model.CandleInterval) string {
	switch interval {
	case model.Interval1m, model.Interval5m, model.Interval15m, model.Interval30m:
		return "7d"
	case model.Interval1h, model.Interval4h:
		return "1mo"
	case model.Interval1d:
		return "1y"
	default:
		return "1mo"
	}
}

func (y *YFinanceProvider) intervalToString(interval model.CandleInterval) string {
	switch interval {
	case model.Interval1m:
		return "1m"
	case model.Interval5m:
		return "5m"
	case model.Interval15m:
		return "15m"
	case model.Interval30m:
		return "30m"
	case model.Interval1h:
		return "1h"
	case model.Interval4h:
		return "4h"
	case model.Interval1d:
		return "1d"
	default:
		return "1d"
	}
}

func (y *YFinanceProvider) quoteCacheKey(symbol, assetType string) string {
	return fmt.Sprintf("quote:%s:%s", symbol, assetType)
}

func (y *YFinanceProvider) candlesCacheKey(symbol, assetType string, interval model.CandleInterval, from, to time.Time, limit int) string {
	fromBucket := from.UTC().Truncate(5 * time.Minute).Unix()
	toBucket := to.UTC().Truncate(5 * time.Minute).Unix()
	return fmt.Sprintf("candles:%s:%s:%s:%d:%d:%d", symbol, assetType, interval, fromBucket, toBucket, limit)
}

func (y *YFinanceProvider) infoCacheKey(symbol, assetType string) string {
	return fmt.Sprintf("info:%s:%s", symbol, assetType)
}

func (y *YFinanceProvider) GetCandles(ctx context.Context, req CandleRequest) (*CandleResponse, error) {
	if y.IsInCooldown() {
		return nil, y.CooldownError(y.ID(), y.Name())
	}

	// Rate limit check
	if err := y.limiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("yfinance rate limit exceeded: %w", err)
	}

	// Execute with circuit breaker
	result, err := y.cb.Execute(func() (interface{}, error) {
		return y.doGetCandles(ctx, req)
	})
	if err != nil {
		return nil, fmt.Errorf("yfinance provider error: %w", err)
	}
	return result.(*CandleResponse), nil
}

// isPermanentGRPCError returns true if the gRPC error code indicates a
// permanent failure that will not succeed on retry (e.g., NOT_FOUND).
func isPermanentGRPCError(err error) bool {
	s, ok := gstatus.FromError(err)
	if !ok {
		return false
	}
	return isPermanentGRPCStatus(s)
}

// isPermanentGRPCStatus returns true if the gRPC status code is permanent.
func isPermanentGRPCStatus(s *gstatus.Status) bool {
	switch s.Code() {
	case gcodes.NotFound, gcodes.InvalidArgument, gcodes.PermissionDenied:
		return true
	default:
		return false
	}
}

// grpcProviderError builds a ProviderError from a gRPC error, classifying
// permanent failures (NOT_FOUND, etc.) as non-retryable and transient
// failures (UNAVAILABLE, DEADLINE_EXCEEDED, etc.) as retryable.
func (y *YFinanceProvider) grpcProviderError(symbol, operation string, err error) *ProviderError {
	code := "GRPC_ERROR"
	retryable := true
	s, ok := gstatus.FromError(err)
	if ok && s.Code() == gcodes.ResourceExhausted {
		y.EnterCooldown(DefaultRetryAfterMax)
		return &ProviderError{
			Provider:          y.ID(),
			Code:              "RATE_LIMITED",
			Message:           fmt.Sprintf("YFinance rate limit exceeded: %v", err),
			Retryable:         true,
			Fallback:          true,
			RetryAfterSeconds: int(DefaultRetryAfterMax.Seconds()),
		}
	}
	if ok && isPermanentGRPCStatus(s) {
		code = "TICKER_NOT_FOUND"
		retryable = false
	}
	return &ProviderError{
		Provider:  y.ID(),
		Code:      code,
		Message:   fmt.Sprintf("failed to %s for %s: %v", operation, symbol, err),
		Retryable: retryable,
	}
}

func (y *YFinanceProvider) doGetCandles(ctx context.Context, req CandleRequest) (*CandleResponse, error) {
	symbol, err := y.MapSymbol(req.Symbol, req.AssetType)
	if err != nil {
		return nil, err
	}

	cacheKey := y.candlesCacheKey(symbol, req.AssetType, req.Interval, req.From, req.To, req.Limit)
	if cached, ok := y.historyCache.get(cacheKey); ok {
		return cached.(*CandleResponse), nil
	}

	pbInterval := y.mapInterval(req.Interval)
	if pbInterval == pb.Interval_INTERVAL_UNSPECIFIED {
		return nil, fmt.Errorf("unsupported interval: %s", req.Interval)
	}

	fromMs := req.From.UTC().UnixMilli()
	toMs := req.To.UTC().UnixMilli()
	limit := int32(req.Limit)
	if limit <= 0 {
		limit = 500
	}
	historyResp, err := y.client.GetHistory(ctx, symbol, y.mapAssetType(req.AssetType), pbInterval, fromMs, toMs, limit)
	if err != nil {
		return nil, y.grpcProviderError(symbol, "get history", err)
	}

	candles := make([]model.Candle, 0, len(historyResp.Bars))
	for _, bar := range historyResp.Bars {
		timestamp := time.UnixMilli(bar.Timestamp)

		if !req.From.IsZero() && timestamp.Before(req.From) {
			continue
		}
		if !req.To.IsZero() && timestamp.After(req.To) {
			continue
		}

		candles = append(candles, model.Candle{
			Symbol:    req.Symbol,
			AssetType: req.AssetType,
			Interval:  req.Interval,
			Open:      model.Money(bar.Open).ToDecimal(),
			High:      model.Money(bar.High).ToDecimal(),
			Low:       model.Money(bar.Low).ToDecimal(),
			Close:     model.Money(bar.Close).ToDecimal(),
			Volume:    decimal.NewFromFloat(bar.Volume),
			Timestamp: timestamp,
			Source:    y.ID(),
		})
	}

	resp := &CandleResponse{
		Candles:   candles,
		Source:    y.ID(),
		Timestamp: time.Now(),
		HasMore:   historyResp.HasMore,
		NextToken: historyResp.NextToken,
	}

	y.historyCache.set(cacheKey, resp, historyCacheTTL)
	return resp, nil
}

func (y *YFinanceProvider) GetQuote(ctx context.Context, req QuoteRequest) (*QuoteResponse, error) {
	if y.IsInCooldown() {
		return nil, y.CooldownError(y.ID(), y.Name())
	}

	if err := y.limiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("yfinance rate limit exceeded: %w", err)
	}

	result, err := y.cb.Execute(func() (interface{}, error) {
		return y.doGetQuote(ctx, req)
	})
	if err != nil {
		return nil, fmt.Errorf("yfinance provider error: %w", err)
	}
	return result.(*QuoteResponse), nil
}

func (y *YFinanceProvider) doGetQuote(ctx context.Context, req QuoteRequest) (*QuoteResponse, error) {
	symbol, err := y.MapSymbol(req.Symbol, req.AssetType)
	if err != nil {
		return nil, err
	}

	cacheKey := y.quoteCacheKey(symbol, req.AssetType)
	if cached, ok := y.priceCache.get(cacheKey); ok {
		return cached.(*QuoteResponse), nil
	}

	priceResp, err := y.client.GetPrice(ctx, symbol)
	if err != nil {
		return nil, y.grpcProviderError(symbol, "get price", err)
	}

	resp := &QuoteResponse{
		Symbol:    req.Symbol,
		Bid:       model.Money(priceResp.Bid).ToDecimal(),
		Ask:       model.Money(priceResp.Ask).ToDecimal(),
		Last:      model.Money(priceResp.Last).ToDecimal(),
		Volume:    priceResp.Volume,
		Timestamp: time.UnixMilli(priceResp.Timestamp),
		Source:    y.ID(),
	}

	y.priceCache.set(cacheKey, resp, priceCacheTTL)
	return resp, nil
}

func (y *YFinanceProvider) GetTechnicalIndicator(ctx context.Context, req TechnicalIndicatorRequest) (*TechnicalIndicatorResponse, error) {
	if y.IsInCooldown() {
		return nil, y.CooldownError(y.ID(), y.Name())
	}

	// Rate limit check
	if err := y.limiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("yfinance rate limit exceeded: %w", err)
	}

	// Execute with circuit breaker
	result, err := y.cb.Execute(func() (interface{}, error) {
		return y.doGetTechnicalIndicator(ctx, req)
	})
	if err != nil {
		return nil, fmt.Errorf("yfinance provider error: %w", err)
	}
	return result.(*TechnicalIndicatorResponse), nil
}

func (y *YFinanceProvider) doGetTechnicalIndicator(ctx context.Context, req TechnicalIndicatorRequest) (*TechnicalIndicatorResponse, error) {
	symbol, err := y.MapSymbol(req.Symbol, req.AssetType)
	if err != nil {
		return nil, err
	}

	cacheKey := y.infoCacheKey(symbol, req.AssetType)
	if cached, ok := y.infoCache.get(cacheKey); ok {
		infoResp := cached.(*pb.InfoResponse)
		return y.buildTechnicalIndicatorResponse(req, infoResp)
	}

	// Fetch info from gRPC sidecar
	infoResp, err := y.client.GetInfo(ctx, symbol)
	if err != nil {
		return nil, y.grpcProviderError(symbol, "get info", err)
	}

	y.infoCache.set(cacheKey, infoResp, infoCacheTTL)

	return y.buildTechnicalIndicatorResponse(req, infoResp)
}

func (y *YFinanceProvider) buildTechnicalIndicatorResponse(req TechnicalIndicatorRequest, infoResp *pb.InfoResponse) (*TechnicalIndicatorResponse, error) {
	company := infoResp.GetCompany()
	if company == nil {
		return &TechnicalIndicatorResponse{
			Indicator: req.Indicator,
			Symbol:    req.Symbol,
			Data:      []TechnicalIndicatorPoint{},
			Source:    y.ID(),
			Timestamp: time.Now(),
		}, nil
	}

	switch req.Indicator {
	case "COMPANY_INFO":
		return &TechnicalIndicatorResponse{
			Indicator: req.Indicator,
			Symbol:    req.Symbol,
			Data: []TechnicalIndicatorPoint{
				{
					Timestamp: time.Now(),
					Value:     1,
				},
			},
			Source:    y.ID(),
			Timestamp: time.Now(),
		}, nil

	case "MARKET_CAP":
		return &TechnicalIndicatorResponse{
			Indicator: req.Indicator,
			Symbol:    req.Symbol,
			Data: []TechnicalIndicatorPoint{
				{
					Timestamp: time.Now(),
					Value:     float64(company.GetMarketCap()),
				},
			},
			Source:    y.ID(),
			Timestamp: time.Now(),
		}, nil

	case "PE_RATIO":
		return &TechnicalIndicatorResponse{
			Indicator: req.Indicator,
			Symbol:    req.Symbol,
			Data: []TechnicalIndicatorPoint{
				{
					Timestamp: time.Now(),
					Value:     company.GetPeRatio(),
				},
			},
			Source:    y.ID(),
			Timestamp: time.Now(),
		}, nil

	case "FIFTY_TWO_WEEK":
		high := company.GetFiftyTwoWeekHigh()
		low := company.GetFiftyTwoWeekLow()
		mid := float64(high+low) / 2
		highFloat := float64(high)
		lowFloat := float64(low)
		return &TechnicalIndicatorResponse{
			Indicator: req.Indicator,
			Symbol:    req.Symbol,
			Data: []TechnicalIndicatorPoint{
				{
					Timestamp: time.Now(),
					Value:     mid,
					UpperBand: &highFloat,
					LowerBand: &lowFloat,
				},
			},
			Source:    y.ID(),
			Timestamp: time.Now(),
		}, nil

	default:
		return &TechnicalIndicatorResponse{
			Indicator: req.Indicator,
			Symbol:    req.Symbol,
			Data:      []TechnicalIndicatorPoint{},
			Source:    y.ID(),
			Timestamp: time.Now(),
		}, nil
	}
}

func (y *YFinanceProvider) ValidateCredentials(ctx context.Context, apiKey string) error {
	if _, err := y.client.GetPrice(ctx, "AAPL"); err != nil {
		return fmt.Errorf("yfinance connection failed: %w", err)
	}
	return nil
}

func (y *YFinanceProvider) IsHealthy(ctx context.Context) bool {
	// Default health check uses a stock symbol.
	return y.checkHealthWithSymbol(ctx, "AAPL")
}

// IsHealthyForAssetType tests with an asset-type-appropriate symbol so that
// the health status is accurate per type (e.g. BTC-USD for CRYPTO, ^SPX for INDEX,
// AAPL for STOCK/ETF/FUND).
func (y *YFinanceProvider) IsHealthyForAssetType(ctx context.Context, assetType string) bool {
	symbol := "AAPL" // default test symbol
	switch assetType {
	case "CRYPTO":
		symbol = "BTC-USD"
	case "INDEX":
		symbol = "^SPX"
	}
	return y.checkHealthWithSymbol(ctx, symbol)
}

// checkHealthWithSymbol performs a health check by fetching the price of a
// known symbol via the gRPC sidecar.
func (y *YFinanceProvider) checkHealthWithSymbol(ctx context.Context, symbol string) bool {
	// The caller (GetProviderHealth) already sets a per-provider timeout via
	// context, so we don't add another one here.
	// If the sidecar is unreachable, the connection attempt + RPC will
	// fail quickly (gRPC uses lazy connect in v1.80+ without WithBlock).
	_, err := y.client.GetPrice(ctx, symbol)
	if err != nil {
		// Reset the connection so ensureConnected() retries on next call.
		// This allows recovery when the sidecar comes back online.
		y.client.ResetConnection()
	}
	return err == nil
}

func (y *YFinanceProvider) cleanupCaches() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			y.priceCache.cleanup()
			y.historyCache.cleanup()
			y.infoCache.cleanup()
		case <-y.stopCleanup:
			return
		}
	}
}

func (y *YFinanceProvider) Close() error {
	close(y.stopCleanup)

	time.Sleep(10 * time.Millisecond)

	return y.client.Close()
}
