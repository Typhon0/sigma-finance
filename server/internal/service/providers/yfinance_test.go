package providers

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	pb "sigma_finance/internal/handler/grpc/pb"

	"github.com/sony/gobreaker"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/time/rate"
	gcodes "google.golang.org/grpc/codes"
	gstatus "google.golang.org/grpc/status"
)

type mockMarketDataClient struct {
	mu           sync.Mutex
	getPriceFn   func(ctx context.Context, symbol string) (*pb.PriceResponse, error)
	getHistoryFn func(ctx context.Context, symbol string, assetType pb.AssetType, interval pb.Interval, fromMs int64, toMs int64, limit int32) (*pb.HistoryResponse, error)
	getInfoFn    func(ctx context.Context, symbol string) (*pb.InfoResponse, error)
	closeFn      func() error
	callCount    int
}

func (m *mockMarketDataClient) GetPrice(ctx context.Context, symbol string) (*pb.PriceResponse, error) {
	m.mu.Lock()
	m.callCount++
	m.mu.Unlock()
	if m.getPriceFn != nil {
		return m.getPriceFn(ctx, symbol)
	}
	return &pb.PriceResponse{
		Symbol:    symbol,
		Last:      15000,
		Bid:       14990,
		Ask:       15010,
		Volume:    1000000,
		Timestamp: time.Now().UnixMilli(),
	}, nil
}

func (m *mockMarketDataClient) GetHistory(ctx context.Context, symbol string, assetType pb.AssetType, interval pb.Interval, fromMs int64, toMs int64, limit int32) (*pb.HistoryResponse, error) {
	m.mu.Lock()
	m.callCount++
	m.mu.Unlock()
	if m.getHistoryFn != nil {
		return m.getHistoryFn(ctx, symbol, assetType, interval, fromMs, toMs, limit)
	}
	return &pb.HistoryResponse{
		Bars: []*pb.OHLCVBar{
			{
				Timestamp: time.Now().Add(-24 * time.Hour).UnixMilli(),
				Open:      14800,
				High:      15200,
				Low:       14700,
				Close:     15000,
				Volume:    500000,
			},
		},
		HasMore: false,
	}, nil
}

func (m *mockMarketDataClient) GetInfo(ctx context.Context, symbol string) (*pb.InfoResponse, error) {
	m.mu.Lock()
	m.callCount++
	m.mu.Unlock()
	if m.getInfoFn != nil {
		return m.getInfoFn(ctx, symbol)
	}
	return &pb.InfoResponse{
		Info: &pb.InfoResponse_Company{
			Company: &pb.CompanyInfo{
				Name:             "Test Company",
				Sector:           "Technology",
				Industry:         "Software",
				MarketCap:        1000000000000,
				PeRatio:          25.5,
				FiftyTwoWeekHigh: 18000,
				FiftyTwoWeekLow:  10000,
			},
		},
	}, nil
}

func (m *mockMarketDataClient) Close() error {
	if m.closeFn != nil {
		return m.closeFn()
	}
	return nil
}

func newTestProvider() *YFinanceProvider {
	return &YFinanceProvider{
		host:          "localhost",
		port:          "50051",
		cb:            newTestCircuitBreaker(),
		limiter:       newTestRateLimiter(),
		priceCache:    newCache(),
		historyCache:  newCache(),
		infoCache:     newCache(),
		stopCleanup:   make(chan struct{}),
		CooldownMixin: NewCooldownMixin(DefaultRetryAfterMax),
	}
}

func newTestCircuitBreaker() *gobreaker.CircuitBreaker {
	return gobreaker.NewCircuitBreaker(gobreaker.Settings{
		Name:        "test-yfinance",
		MaxRequests: 3,
		Interval:    10 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.TotalFailures >= 5
		},
	})
}

func newTestRateLimiter() *rate.Limiter {
	return rate.NewLimiter(rate.Inf, 1000)
}

func TestNewYFinanceProvider_EmptyHost(t *testing.T) {
	cfg := YFinanceConfig{Host: "", Port: "50051"}
	_, err := NewYFinanceProvider(cfg)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "host cannot be empty")
}

func TestNewYFinanceProvider_EmptyPort(t *testing.T) {
	cfg := YFinanceConfig{Host: "localhost", Port: ""}
	_, err := NewYFinanceProvider(cfg)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "port cannot be empty")
}

func TestCache_HitAndMiss(t *testing.T) {
	cache := newCache()

	_, ok := cache.get("nonexistent")
	assert.False(t, ok)

	cache.set("test-key", "test-value", 1*time.Hour)
	val, ok := cache.get("test-key")
	assert.True(t, ok)
	assert.Equal(t, "test-value", val)

	cache.set("expiring-key", "expiring-value", 1*time.Millisecond)
	time.Sleep(10 * time.Millisecond)
	_, ok = cache.get("expiring-key")
	assert.False(t, ok)
}

func TestCache_Cleanup(t *testing.T) {
	cache := newCache()

	cache.set("key1", "value1", 1*time.Millisecond)
	cache.set("key2", "value2", 1*time.Hour)

	time.Sleep(10 * time.Millisecond)
	cache.cleanup()

	_, ok := cache.get("key1")
	assert.False(t, ok)

	_, ok = cache.get("key2")
	assert.True(t, ok)
}

func TestMapSymbol(t *testing.T) {
	provider := &YFinanceProvider{}

	tests := []struct {
		name      string
		symbol    string
		assetType string
		expected  string
	}{
		{"stock uppercase", "aapl", "STOCK", "AAPL"},
		{"stock with exchange", "AAPL:US", "STOCK", "AAPL"},
		{"fund", "VTI", "FUND", "VTI"},
		{"crypto", "BTC/USD", "CRYPTO", "BTC-USD"},
		{"index bare", "^SPX", "INDEX", "^SPX"},
		{"index with exchange suffix", "^SPX:INDICES", "INDEX", "^SPX"},
		{"etf", "SPY", "ETF", "SPY"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := provider.MapSymbol(tt.symbol, tt.assetType)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestNormalizeSymbol(t *testing.T) {
	provider := &YFinanceProvider{}

	result, err := provider.NormalizeSymbol("aapl", "STOCK")
	require.NoError(t, err)
	assert.Equal(t, "AAPL", result)
}

func TestCapabilities(t *testing.T) {
	provider := &YFinanceProvider{}

	caps := provider.Capabilities()

	assert.Equal(t, "YFINANCE", provider.ID())
	assert.Equal(t, "Yahoo Finance", provider.Name())
	assert.Equal(t, ProviderTypeStock, provider.Type())
	assert.Contains(t, caps.AssetTypes, "STOCK")
	assert.Contains(t, caps.AssetTypes, "FUND")
	assert.False(t, caps.SupportsRealtime)
	assert.False(t, caps.RequiresAPIKey)
}

func TestIntervalMapping(t *testing.T) {
	provider := &YFinanceProvider{}

	tests := []struct {
		interval model.CandleInterval
		expected pb.Interval
	}{
		{model.Interval1m, pb.Interval_INTERVAL_1M},
		{model.Interval5m, pb.Interval_INTERVAL_5M},
		{model.Interval15m, pb.Interval_INTERVAL_15M},
		{model.Interval1h, pb.Interval_INTERVAL_1H},
		{model.Interval1d, pb.Interval_INTERVAL_1D},
	}

	for _, tt := range tests {
		result := provider.mapInterval(tt.interval)
		assert.Equal(t, tt.expected, result)
	}
}

func TestAssetTypeMapping(t *testing.T) {
	provider := &YFinanceProvider{}

	tests := []struct {
		assetType string
		expected  pb.AssetType
	}{
		{"STOCK", pb.AssetType_ASSET_TYPE_STOCK},
		{"FUND", pb.AssetType_ASSET_TYPE_FUND},
		{"CRYPTO", pb.AssetType_ASSET_TYPE_CRYPTO},
		{"ETF", pb.AssetType_ASSET_TYPE_ETF},
		{"INDEX", pb.AssetType_ASSET_TYPE_INDEX},
		{"UNKNOWN", pb.AssetType_ASSET_TYPE_UNSPECIFIED},
	}

	for _, tt := range tests {
		result := provider.mapAssetType(tt.assetType)
		assert.Equal(t, tt.expected, result)
	}
}

func TestPeriodFromInterval(t *testing.T) {
	provider := &YFinanceProvider{}

	tests := []struct {
		interval model.CandleInterval
		expected string
	}{
		{model.Interval1m, "7d"},
		{model.Interval5m, "7d"},
		{model.Interval1h, "1mo"},
		{model.Interval1d, "1y"},
	}

	for _, tt := range tests {
		result := provider.periodFromInterval(tt.interval)
		assert.Equal(t, tt.expected, result)
	}
}

func TestIntervalToString(t *testing.T) {
	provider := &YFinanceProvider{}

	tests := []struct {
		interval model.CandleInterval
		expected string
	}{
		{model.Interval1m, "1m"},
		{model.Interval5m, "5m"},
		{model.Interval1h, "1h"},
		{model.Interval1d, "1d"},
	}

	for _, tt := range tests {
		result := provider.intervalToString(tt.interval)
		assert.Equal(t, tt.expected, result)
	}
}

func TestClose_StopCleanupChannel(t *testing.T) {
	provider := &YFinanceProvider{
		stopCleanup: make(chan struct{}),
	}

	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
			case <-provider.stopCleanup:
				return
			}
		}
	}()

	close(provider.stopCleanup)

	select {
	case <-provider.stopCleanup:
	default:
		t.Error("stopCleanup channel should be closed")
	}
}

func TestProviderError(t *testing.T) {
	err := &ProviderError{
		Provider:  "YFINANCE",
		Code:      "TEST_ERROR",
		Message:   "test error message",
		Retryable: true,
	}

	assert.Equal(t, "YFINANCE", err.Provider)
	assert.Equal(t, "TEST_ERROR", err.Code)
	assert.Contains(t, err.Error(), "test error message")
	assert.True(t, err.Retryable)
}

func TestRateLimitConfig(t *testing.T) {
	limiter := rate.NewLimiter(rate.Limit(0.5), 2)

	assert.NotNil(t, limiter)
	assert.Equal(t, rate.Limit(0.5), limiter.Limit())
	assert.Equal(t, 2, limiter.Burst())
}

func TestCircuitBreakerConfig(t *testing.T) {
	cb := newTestCircuitBreaker()

	assert.NotNil(t, cb)
	assert.Equal(t, "test-yfinance", cb.Name())
}

func TestConcurrentCacheAccess(t *testing.T) {
	cache := newCache()
	var wg sync.WaitGroup

	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			cache.set(string(rune(i)), i, 1*time.Hour)
		}(i)
	}

	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			cache.get(string(rune(i)))
		}(i)
	}

	wg.Wait()
}

func TestCacheDelete(t *testing.T) {
	cache := newCache()

	cache.set("key", "value", 1*time.Hour)
	_, ok := cache.get("key")
	assert.True(t, ok)

	cache.delete("key")
	_, ok = cache.get("key")
	assert.False(t, ok)
}

func TestContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	select {
	case <-ctx.Done():
	default:
		t.Error("Context should be cancelled")
	}
}

func TestBuildTechnicalIndicatorResponse(t *testing.T) {
	provider := &YFinanceProvider{}

	tests := []struct {
		name      string
		indicator string
		infoResp  *pb.InfoResponse
	}{
		{
			name:      "company_info",
			indicator: "COMPANY_INFO",
			infoResp: &pb.InfoResponse{
				Info: &pb.InfoResponse_Company{
					Company: &pb.CompanyInfo{Name: "Test"},
				},
			},
		},
		{
			name:      "market_cap",
			indicator: "MARKET_CAP",
			infoResp: &pb.InfoResponse{
				Info: &pb.InfoResponse_Company{
					Company: &pb.CompanyInfo{MarketCap: 1000000},
				},
			},
		},
		{
			name:      "pe_ratio",
			indicator: "PE_RATIO",
			infoResp: &pb.InfoResponse{
				Info: &pb.InfoResponse_Company{
					Company: &pb.CompanyInfo{PeRatio: 25.5},
				},
			},
		},
		{
			name:      "fifty_two_week",
			indicator: "FIFTY_TWO_WEEK",
			infoResp: &pb.InfoResponse{
				Info: &pb.InfoResponse_Company{
					Company: &pb.CompanyInfo{
						FiftyTwoWeekHigh: 200,
						FiftyTwoWeekLow:  100,
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := TechnicalIndicatorRequest{
				Symbol:    "AAPL",
				AssetType: "STOCK",
				Indicator: tt.indicator,
			}

			resp, err := provider.buildTechnicalIndicatorResponse(req, tt.infoResp)
			require.NoError(t, err)
			assert.Equal(t, tt.indicator, resp.Indicator)
			assert.Equal(t, "AAPL", resp.Symbol)
			assert.Equal(t, "YFINANCE", resp.Source)
		})
	}
}

func TestQuoteCacheKey(t *testing.T) {
	provider := &YFinanceProvider{}
	key := provider.quoteCacheKey("AAPL", "STOCK")
	assert.Contains(t, key, "AAPL")
	assert.Contains(t, key, "STOCK")
}

func TestCandlesCacheKey(t *testing.T) {
	provider := &YFinanceProvider{}
	key := provider.candlesCacheKey("AAPL", "STOCK", model.Interval1d, time.Now(), time.Now().Add(24*time.Hour), 100)
	assert.Contains(t, key, "AAPL")
	assert.Contains(t, key, "STOCK")
}

func TestInfoCacheKey(t *testing.T) {
	provider := &YFinanceProvider{}
	key := provider.infoCacheKey("AAPL", "STOCK")
	assert.Contains(t, key, "AAPL")
	assert.Contains(t, key, "STOCK")
}

func TestIsPermanentGRPCError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "not_found_is_permanent",
			err:      gstatus.Error(gcodes.NotFound, "not found"),
			expected: true,
		},
		{
			name:     "invalid_argument_is_permanent",
			err:      gstatus.Error(gcodes.InvalidArgument, "invalid"),
			expected: true,
		},
		{
			name:     "permission_denied_is_permanent",
			err:      gstatus.Error(gcodes.PermissionDenied, "denied"),
			expected: true,
		},
		{
			name:     "unavailable_is_transient",
			err:      gstatus.Error(gcodes.Unavailable, "down"),
			expected: false,
		},
		{
			name:     "deadline_exceeded_is_transient",
			err:      gstatus.Error(gcodes.DeadlineExceeded, "timeout"),
			expected: false,
		},
		{
			name:     "wrapped_not_found_is_permanent",
			err:      fmt.Errorf("failed: %w", gstatus.Error(gcodes.NotFound, "not found")),
			expected: true,
		},
		{
			name:     "nil_is_not_permanent",
			err:      nil,
			expected: false,
		},
		{
			name:     "plain_error_is_not_permanent",
			err:      errors.New("some error"),
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, isPermanentGRPCError(tt.err))
		})
	}
}

func TestGRPCProviderError_NotFoundIsNotRetryable(t *testing.T) {
	err := gstatus.Error(gcodes.NotFound, "no history data found for symbol: ABEA.F")
	provider := newTestProvider()
	providerErr := provider.grpcProviderError("ABEA.F", "get history", err)

	assert.Equal(t, "TICKER_NOT_FOUND", providerErr.Code)
	assert.False(t, providerErr.Retryable)
	assert.Contains(t, providerErr.Message, "ABEA.F")
}

func TestGRPCProviderError_UnavailableIsRetryable(t *testing.T) {
	err := gstatus.Error(gcodes.Unavailable, "connection refused")
	provider := newTestProvider()
	providerErr := provider.grpcProviderError("AAPL", "get price", err)

	assert.Equal(t, "GRPC_ERROR", providerErr.Code)
	assert.True(t, providerErr.Retryable)
}

func TestGRPCProviderError_CanceledIsRetryable(t *testing.T) {
	err := gstatus.Error(gcodes.Canceled, "context canceled")
	provider := newTestProvider()
	providerErr := provider.grpcProviderError("MSFT", "get info", err)

	assert.Equal(t, "GRPC_ERROR", providerErr.Code)
	assert.True(t, providerErr.Retryable)
}

func TestGRPCProviderError_ResourceExhaustedEntersCooldown(t *testing.T) {
	err := gstatus.Error(gcodes.ResourceExhausted, "rate limit exceeded")
	provider := newTestProvider()

	// Should not be in cooldown before
	assert.False(t, provider.IsInCooldown())

	providerErr := provider.grpcProviderError("AAPL", "get price", err)

	// Should be in cooldown after
	assert.True(t, provider.IsInCooldown())

	// Error should indicate rate limiting
	assert.Equal(t, "RATE_LIMITED", providerErr.Code)
	assert.True(t, providerErr.Retryable)
	assert.True(t, providerErr.Fallback)
	assert.Equal(t, int(DefaultRetryAfterMax.Seconds()), providerErr.RetryAfterSeconds)
}
