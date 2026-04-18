package providers

import (
	"context"
	"fmt"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/shopspring/decimal"
)

// ProviderType represents the category of market data provider
type ProviderType string

const (
	ProviderTypeCrypto ProviderType = "CRYPTO"
	ProviderTypeStock  ProviderType = "STOCK"
	ProviderTypeForex  ProviderType = "FOREX"
)

// ProviderCapabilities defines what a provider supports
type ProviderCapabilities struct {
	Intervals        []model.CandleInterval
	MaxHistoryDays   int
	SupportsRealtime bool
	RequiresAPIKey   bool
	RateLimit        RateLimit
	AssetTypes       []string
}

// RateLimit defines provider rate limiting
type RateLimit struct {
	RequestsPerMinute int
	RequestsPerDay    int
	BurstLimit        int
}

// SymbolMapping handles provider-specific symbol formats
type SymbolMapping struct {
	InternalSymbol string
	ProviderSymbol string
	AssetType      string
	Venue          string
}

// CandleRequest represents a request for candle data
type CandleRequest struct {
	Symbol    string
	AssetType string
	Interval  model.CandleInterval
	From      time.Time
	To        time.Time
	Limit     int
	APIKey    string
}

// CandleResponse represents the response from a provider
type CandleResponse struct {
	Candles   []model.Candle
	Source    string
	Timestamp time.Time
	HasMore   bool
	NextToken string
}

// QuoteRequest represents a request for current price quote
type QuoteRequest struct {
	Symbol    string
	AssetType string
	APIKey    string
}

// QuoteResponse represents the response from a quote request
type QuoteResponse struct {
	Symbol    string          `json:"symbol"`
	Bid       decimal.Decimal `json:"bid"`
	Ask       decimal.Decimal `json:"ask"`
	Last      decimal.Decimal `json:"last"`
	Volume    int64           `json:"volume"`
	Timestamp time.Time       `json:"timestamp"`
	Source    string          `json:"source"`
}

// Provider defines the interface for market data providers
type Provider interface {
	// Identification
	ID() string
	Name() string
	Type() ProviderType
	Capabilities() ProviderCapabilities

	// Symbol mapping
	MapSymbol(internalSymbol, assetType string) (string, error)
	NormalizeSymbol(providerSymbol, assetType string) (string, error)

	// Data fetching
	GetCandles(ctx context.Context, req CandleRequest) (*CandleResponse, error)
	GetQuote(ctx context.Context, req QuoteRequest) (*QuoteResponse, error)
	GetTechnicalIndicator(ctx context.Context, req TechnicalIndicatorRequest) (*TechnicalIndicatorResponse, error)
	ValidateCredentials(ctx context.Context, apiKey string) error

	// Health check
	IsHealthy(ctx context.Context) bool
}

// ProviderError represents an error from a market data provider with metadata
// for intelligent routing fallback decisions.
type ProviderError struct {
	Provider  string // Which provider returned this error
	Code      string // Machine-readable error code (TICKER_NOT_FOUND, RATE_LIMITED, etc.)
	Message   string // Human-readable error message
	HTTPCode  int    // HTTP status code from the provider (0 if N/A)
	Retryable bool   // Whether this error is transient and retrying might succeed
	Fallback  bool   // Whether fallback to another provider should be attempted
}

func (e *ProviderError) Error() string {
	return fmt.Sprintf("%s: [%s] %s (http=%d, retryable=%v, fallback=%v)",
		e.Provider, e.Code, e.Message, e.HTTPCode, e.Retryable, e.Fallback)
}

// IsTickerNotFound returns true if the error indicates the symbol was not found
// on the provider (e.g., international stock on Tiingo).
func IsTickerNotFound(err error) bool {
	if pe, ok := err.(*ProviderError); ok {
		return pe.Code == "TICKER_NOT_FOUND"
	}
	return false
}

// IsRateLimited returns true if the error indicates a rate limit was hit.
func IsRateLimited(err error) bool {
	if pe, ok := err.(*ProviderError); ok {
		return pe.Code == "RATE_LIMITED"
	}
	return false
}

// TechnicalIndicatorRequest represents a request for a technical indicator.
type TechnicalIndicatorRequest struct {
	Symbol     string
	AssetType  string
	Indicator  string // SMA, EMA, RSI, MACD, BBANDS, STOCH
	TimePeriod int    // Number of periods (e.g., 14 for RSI)
	SeriesType string // close, open, high, low, volume
	Interval   model.CandleInterval
	From       time.Time
	To         time.Time
	APIKey     string
}

// TechnicalIndicatorPoint represents a single data point of a technical indicator.
type TechnicalIndicatorPoint struct {
	Timestamp time.Time
	// For SMA/EMA/RSI: Value contains the indicator value
	// For MACD: Value = MACD line, Signal = signal line, Histogram = histogram
	// For BBANDS: UpperBand, MiddleBand (Value), LowerBand
	Value     float64
	Signal    *float64 // MACD signal line
	Histogram *float64 // MACD histogram
	UpperBand *float64 // Bollinger Bands upper
	LowerBand *float64 // Bollinger Bands lower
}

// TechnicalIndicatorResponse represents the response from a technical indicator query.
type TechnicalIndicatorResponse struct {
	Indicator string
	Symbol    string
	Data      []TechnicalIndicatorPoint
	Source    string
	Timestamp time.Time
}

// ResilientProvider wraps a Provider with circuit breaker and rate limiting.
type ResilientProvider struct {
	Provider
	cb      CircuitBreaker
	limiter RateLimiterFunc
}

// CircuitBreaker interface abstracts circuit breaker implementations.
type CircuitBreaker interface {
	Execute(fn func() (interface{}, error)) (interface{}, error)
}

// RateLimiterFunc is a function that blocks until the rate limit allows a request.
type RateLimiterFunc func() error

// AssetTypeHealthChecker is an optional interface that providers can implement
// to provide per-asset-type health checks. If a provider supports multiple
// asset types (e.g. both STOCK and CRYPTO), it may test with different symbols
// per type to give more accurate health status.
// Providers that don't implement this interface fall back to IsHealthy()
// for all their supported asset types.
type AssetTypeHealthChecker interface {
	IsHealthyForAssetType(ctx context.Context, assetType string) bool
}

// ProviderHealthEntry represents the health status of a provider for a
// specific asset type. Providers that support multiple asset types produce
// one entry per supported type.
type ProviderHealthEntry struct {
	Provider  string
	AssetType string // e.g. "STOCK", "CRYPTO", "FUND"
	Healthy   bool
}

// ProviderManager manages multiple providers and routing
type ProviderManager interface {
	RegisterProvider(provider Provider)
	GetProvider(id string) (Provider, bool)
	GetProvidersForAssetType(assetType string) []Provider
	GetAllProviders() []Provider
	SelectBestProvider(assetType, symbol string, interval model.CandleInterval, requiresKey bool) (Provider, error)
	// LearnProvider associates a ticker with its working provider for future routing.
	LearnProvider(symbol, assetType, providerID string)
	// GetLearnedProvider returns the remembered provider for a ticker, if any.
	GetLearnedProvider(symbol, assetType string) (string, bool)
}
