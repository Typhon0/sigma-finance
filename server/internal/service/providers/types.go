package providers

import (
	"context"
	"sigma_finance/internal/domain/model"
	"time"
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
	ValidateCredentials(ctx context.Context, apiKey string) error

	// Health check
	IsHealthy(ctx context.Context) bool
}

// ProviderManager manages multiple providers and routing
type ProviderManager interface {
	RegisterProvider(provider Provider)
	GetProvider(id string) (Provider, bool)
	GetProvidersForAssetType(assetType string) []Provider
	SelectBestProvider(assetType, symbol string, interval model.CandleInterval, requiresKey bool) (Provider, error)
}
