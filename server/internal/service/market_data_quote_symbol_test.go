package service

import (
	"context"
	"fmt"
	"testing"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service/providers"
)

type stubInstrumentProviderMappingService struct {
	getVerifiedFn         func(ctx context.Context, instrumentID string, provider string) (*model.InstrumentProviderMapping, error)
	ensureDeterministicFn func(ctx context.Context, instrumentID string, provider string) (*model.InstrumentProviderMapping, error)
}

func (s *stubInstrumentProviderMappingService) GetVerifiedMapping(ctx context.Context, instrumentID string, provider string) (*model.InstrumentProviderMapping, error) {
	if s.getVerifiedFn == nil {
		return nil, repository.ErrNotFound
	}
	return s.getVerifiedFn(ctx, instrumentID, provider)
}

func (s *stubInstrumentProviderMappingService) EnsureDeterministicMapping(ctx context.Context, instrumentID string, provider string) (*model.InstrumentProviderMapping, error) {
	if s.ensureDeterministicFn == nil {
		return nil, repository.ErrNotFound
	}
	return s.ensureDeterministicFn(ctx, instrumentID, provider)
}

func (s *stubInstrumentProviderMappingService) ListMappings(ctx context.Context, instrumentID string) ([]model.InstrumentProviderMapping, error) {
	return []model.InstrumentProviderMapping{}, nil
}

func (s *stubInstrumentProviderMappingService) InvalidateMapping(ctx context.Context, instrumentID string, provider string, reason string) error {
	return nil
}

type stubCredentialRepo struct{}

func (s *stubCredentialRepo) Create(ctx context.Context, cred *model.MarketDataCredential) (*model.MarketDataCredential, error) {
	return cred, nil
}

func (s *stubCredentialRepo) Update(ctx context.Context, cred *model.MarketDataCredential) error {
	return nil
}

func (s *stubCredentialRepo) GetByUserAndProvider(ctx context.Context, userID string, provider string) (*model.MarketDataCredential, error) {
	return nil, repository.ErrNotFound
}

func (s *stubCredentialRepo) ListByUser(ctx context.Context, userID string) ([]model.MarketDataCredential, error) {
	return []model.MarketDataCredential{}, nil
}

func (s *stubCredentialRepo) ListEnabledByUser(ctx context.Context, userID string) ([]model.MarketDataCredential, error) {
	return []model.MarketDataCredential{}, nil
}

func (s *stubCredentialRepo) ListSystemWide(ctx context.Context) ([]model.MarketDataCredential, error) {
	return []model.MarketDataCredential{}, nil
}

func (s *stubCredentialRepo) ListAll(ctx context.Context) ([]model.MarketDataCredential, error) {
	return []model.MarketDataCredential{}, nil
}

func (s *stubCredentialRepo) Delete(ctx context.Context, id string) error {
	return nil
}

type strictCredentialRepo struct {
	systemCreds    []model.MarketDataCredential
	listAllInvoked bool
}

func (s *strictCredentialRepo) Create(ctx context.Context, cred *model.MarketDataCredential) (*model.MarketDataCredential, error) {
	return cred, nil
}

func (s *strictCredentialRepo) Update(ctx context.Context, cred *model.MarketDataCredential) error {
	return nil
}

func (s *strictCredentialRepo) GetByUserAndProvider(ctx context.Context, userID string, provider string) (*model.MarketDataCredential, error) {
	return nil, repository.ErrNotFound
}

func (s *strictCredentialRepo) ListByUser(ctx context.Context, userID string) ([]model.MarketDataCredential, error) {
	return []model.MarketDataCredential{}, nil
}

func (s *strictCredentialRepo) ListEnabledByUser(ctx context.Context, userID string) ([]model.MarketDataCredential, error) {
	return []model.MarketDataCredential{}, nil
}

func (s *strictCredentialRepo) ListSystemWide(ctx context.Context) ([]model.MarketDataCredential, error) {
	return s.systemCreds, nil
}

func (s *strictCredentialRepo) ListAll(ctx context.Context) ([]model.MarketDataCredential, error) {
	s.listAllInvoked = true
	return nil, fmt.Errorf("ListAll must not be used by runtime price fetch")
}

func (s *strictCredentialRepo) Delete(ctx context.Context, id string) error {
	return nil
}

type captureSymbolProvider struct {
	id           string
	quoteSymbols []string
	candleSymbol []string
}

func (p *captureSymbolProvider) ID() string                   { return p.id }
func (p *captureSymbolProvider) Name() string                 { return "capture" }
func (p *captureSymbolProvider) Type() providers.ProviderType { return providers.ProviderTypeCrypto }
func (p *captureSymbolProvider) Capabilities() providers.ProviderCapabilities {
	return providers.ProviderCapabilities{
		Intervals:        []model.CandleInterval{model.Interval1m},
		SupportsRealtime: true,
		RequiresAPIKey:   false,
		AssetTypes:       []string{string(model.AssetTypeCrypto)},
	}
}
func (p *captureSymbolProvider) MapSymbol(internalSymbol, assetType string) (string, error) {
	return internalSymbol, nil
}
func (p *captureSymbolProvider) NormalizeSymbol(providerSymbol, assetType string) (string, error) {
	return providerSymbol, nil
}
func (p *captureSymbolProvider) GetCandles(ctx context.Context, req providers.CandleRequest) (*providers.CandleResponse, error) {
	p.candleSymbol = append(p.candleSymbol, req.Symbol)
	return nil, fmt.Errorf("no candles")
}
func (p *captureSymbolProvider) GetQuote(ctx context.Context, req providers.QuoteRequest) (*providers.QuoteResponse, error) {
	p.quoteSymbols = append(p.quoteSymbols, req.Symbol)
	return nil, fmt.Errorf("no quote")
}
func (p *captureSymbolProvider) GetTechnicalIndicator(ctx context.Context, req providers.TechnicalIndicatorRequest) (*providers.TechnicalIndicatorResponse, error) {
	return nil, fmt.Errorf("not implemented")
}
func (p *captureSymbolProvider) ValidateCredentials(ctx context.Context, apiKey string) error {
	return nil
}
func (p *captureSymbolProvider) IsHealthy(ctx context.Context) bool { return true }

func TestResolveProviderQuoteSymbolForInstrument_UsesVerifiedMapping(t *testing.T) {
	service := &marketDataService{
		mappingService: &stubInstrumentProviderMappingService{
			getVerifiedFn: func(ctx context.Context, instrumentID string, provider string) (*model.InstrumentProviderMapping, error) {
				return &model.InstrumentProviderMapping{
					InstrumentID:    instrumentID,
					Provider:        provider,
					ProviderAssetID: "BTCUSDT",
					ProviderSymbol:  ptrString("BTC/USDT"),
					MappingStatus:   model.InstrumentProviderMappingStatusVerified,
				}, nil
			},
		},
		runtimeCache: make(map[string]*instrumentCandlesCacheEntry),
	}

	instrument := &model.Instrument{ID: "inst-1", Symbol: "BTC"}
	symbol, mapping, err := service.resolveProviderQuoteSymbolForInstrument(context.Background(), instrument, "BINANCE")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if symbol != "BTC/USDT" {
		t.Fatalf("expected mapped provider symbol BTC/USDT, got %s", symbol)
	}
	if mapping == nil {
		t.Fatal("expected mapping to be returned")
	}
}

func TestResolveProviderQuoteSymbolForInstrument_UsesDeterministicMappingFallback(t *testing.T) {
	service := &marketDataService{
		mappingService: &stubInstrumentProviderMappingService{
			getVerifiedFn: func(ctx context.Context, instrumentID string, provider string) (*model.InstrumentProviderMapping, error) {
				return nil, repository.ErrNotFound
			},
			ensureDeterministicFn: func(ctx context.Context, instrumentID string, provider string) (*model.InstrumentProviderMapping, error) {
				return &model.InstrumentProviderMapping{
					InstrumentID:    instrumentID,
					Provider:        provider,
					ProviderAssetID: "ETHUSDT",
					ProviderSymbol:  ptrString("ETHUSDT"),
					MappingStatus:   model.InstrumentProviderMappingStatusVerified,
				}, nil
			},
		},
		runtimeCache: make(map[string]*instrumentCandlesCacheEntry),
	}

	instrument := &model.Instrument{ID: "inst-2", Symbol: "ETH"}
	symbol, _, err := service.resolveProviderQuoteSymbolForInstrument(context.Background(), instrument, "BINANCE")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if symbol != "ETHUSDT" {
		t.Fatalf("expected deterministic mapped symbol ETHUSDT, got %s", symbol)
	}

	stats := service.GetRuntimeMarketDataInvalidationStats()
	if stats.MappingEvents != 1 {
		t.Fatalf("expected mapping cache invalidation event, got %d", stats.MappingEvents)
	}
}

func TestResolveProviderQuoteSymbolForInstrument_ErrorsWithoutVerifiedMapping(t *testing.T) {
	service := &marketDataService{
		mappingService: &stubInstrumentProviderMappingService{
			getVerifiedFn: func(ctx context.Context, instrumentID string, provider string) (*model.InstrumentProviderMapping, error) {
				return nil, repository.ErrNotFound
			},
			ensureDeterministicFn: func(ctx context.Context, instrumentID string, provider string) (*model.InstrumentProviderMapping, error) {
				return nil, repository.ErrNotFound
			},
		},
	}

	instrument := &model.Instrument{ID: "inst-3", Symbol: "SOL"}
	_, _, err := service.resolveProviderQuoteSymbolForInstrument(context.Background(), instrument, "BINANCE")
	if err == nil {
		t.Fatal("expected error when no mapping is available")
	}
}

func TestFetchAndStoreAssetPriceFromProvider_UsesMappedProviderSymbolForLinkedInstrument(t *testing.T) {
	providerManager := providers.NewProviderManager()
	captureProvider := &captureSymbolProvider{id: "BINANCE"}
	providerManager.RegisterProvider(captureProvider)

	service := &marketDataService{
		providerManager: providerManager,
		credRepo:        &stubCredentialRepo{},
		mappingService: &stubInstrumentProviderMappingService{
			getVerifiedFn: func(ctx context.Context, instrumentID string, provider string) (*model.InstrumentProviderMapping, error) {
				return &model.InstrumentProviderMapping{
					InstrumentID:   instrumentID,
					Provider:       provider,
					ProviderSymbol: ptrString("BTCUSDT"),
					MappingStatus:  model.InstrumentProviderMappingStatusVerified,
				}, nil
			},
		},
		runtimeCache: make(map[string]*instrumentCandlesCacheEntry),
	}

	asset := &model.Asset{
		ID:          "asset-1",
		Name:        "Bitcoin",
		Type:        model.AssetTypeCrypto,
		Symbol:      ptrString("BTC"),
		IsTradeable: true,
	}
	instrument := &model.Instrument{ID: "inst-1", Symbol: "BTC", AssetType: model.InstrumentAssetTypeCrypto}

	_, err := service.fetchAndStoreAssetPriceFromProvider(context.Background(), asset, instrument)
	if err == nil {
		t.Fatal("expected provider failure for capture test")
	}
	if len(captureProvider.quoteSymbols) == 0 {
		t.Fatal("expected quote request to be attempted")
	}
	if captureProvider.quoteSymbols[0] != "BTCUSDT" {
		t.Fatalf("expected mapped quote symbol BTCUSDT, got %s", captureProvider.quoteSymbols[0])
	}
	if len(captureProvider.candleSymbol) == 0 {
		t.Fatal("expected candle fallback request to be attempted")
	}
	if captureProvider.candleSymbol[0] != "BTCUSDT" {
		t.Fatalf("expected mapped candle symbol BTCUSDT, got %s", captureProvider.candleSymbol[0])
	}
}

func TestFetchAndStoreAssetPriceFromProvider_UsesRawSymbolWithoutInstrumentLink(t *testing.T) {
	providerManager := providers.NewProviderManager()
	captureProvider := &captureSymbolProvider{id: "BINANCE"}
	providerManager.RegisterProvider(captureProvider)

	service := &marketDataService{
		providerManager: providerManager,
		credRepo:        &stubCredentialRepo{},
		mappingService:  &stubInstrumentProviderMappingService{},
		runtimeCache:    make(map[string]*instrumentCandlesCacheEntry),
	}

	asset := &model.Asset{
		ID:          "asset-2",
		Name:        "Ethereum",
		Type:        model.AssetTypeCrypto,
		Symbol:      ptrString("ETHUSDT"),
		IsTradeable: true,
	}

	_, err := service.fetchAndStoreAssetPriceFromProvider(context.Background(), asset, nil)
	if err == nil {
		t.Fatal("expected provider failure for capture test")
	}
	if len(captureProvider.quoteSymbols) == 0 {
		t.Fatal("expected quote request to be attempted")
	}
	if captureProvider.quoteSymbols[0] != "ETHUSDT" {
		t.Fatalf("expected raw quote symbol ETHUSDT, got %s", captureProvider.quoteSymbols[0])
	}
	if len(captureProvider.candleSymbol) == 0 {
		t.Fatal("expected candle fallback request to be attempted")
	}
	if captureProvider.candleSymbol[0] != "ETHUSDT" {
		t.Fatalf("expected raw candle symbol ETHUSDT, got %s", captureProvider.candleSymbol[0])
	}
}

type keyRequiredCaptureProvider struct {
	id         string
	quoteCount int
}

func (p *keyRequiredCaptureProvider) ID() string   { return p.id }
func (p *keyRequiredCaptureProvider) Name() string { return "key-required-capture" }
func (p *keyRequiredCaptureProvider) Type() providers.ProviderType {
	return providers.ProviderTypeCrypto
}
func (p *keyRequiredCaptureProvider) Capabilities() providers.ProviderCapabilities {
	return providers.ProviderCapabilities{
		Intervals:        []model.CandleInterval{model.Interval1m},
		SupportsRealtime: true,
		RequiresAPIKey:   true,
		AssetTypes:       []string{string(model.AssetTypeCrypto)},
	}
}
func (p *keyRequiredCaptureProvider) MapSymbol(internalSymbol, assetType string) (string, error) {
	return internalSymbol, nil
}
func (p *keyRequiredCaptureProvider) NormalizeSymbol(providerSymbol, assetType string) (string, error) {
	return providerSymbol, nil
}
func (p *keyRequiredCaptureProvider) GetCandles(ctx context.Context, req providers.CandleRequest) (*providers.CandleResponse, error) {
	return nil, fmt.Errorf("no candles")
}
func (p *keyRequiredCaptureProvider) GetQuote(ctx context.Context, req providers.QuoteRequest) (*providers.QuoteResponse, error) {
	p.quoteCount++
	return nil, fmt.Errorf("no quote")
}
func (p *keyRequiredCaptureProvider) GetTechnicalIndicator(ctx context.Context, req providers.TechnicalIndicatorRequest) (*providers.TechnicalIndicatorResponse, error) {
	return nil, fmt.Errorf("not implemented")
}
func (p *keyRequiredCaptureProvider) ValidateCredentials(ctx context.Context, apiKey string) error {
	return nil
}
func (p *keyRequiredCaptureProvider) IsHealthy(ctx context.Context) bool { return true }

func TestFetchAndStoreAssetPriceFromProvider_DoesNotUseListAllFallback(t *testing.T) {
	providerManager := providers.NewProviderManager()
	keyProvider := &keyRequiredCaptureProvider{id: "KEYONLY"}
	providerManager.RegisterProvider(keyProvider)

	credRepo := &strictCredentialRepo{
		systemCreds: []model.MarketDataCredential{},
	}

	service := &marketDataService{
		providerManager: providerManager,
		credRepo:        credRepo,
		mappingService:  &stubInstrumentProviderMappingService{},
		runtimeCache:    make(map[string]*instrumentCandlesCacheEntry),
	}

	asset := &model.Asset{
		ID:          "asset-3",
		Name:        "Credential Scope Test",
		Type:        model.AssetTypeCrypto,
		Symbol:      ptrString("BTCUSDT"),
		IsTradeable: true,
	}

	_, err := service.fetchAndStoreAssetPriceFromProvider(context.Background(), asset, nil)
	if err == nil {
		t.Fatal("expected no provider data error")
	}
	if credRepo.listAllInvoked {
		t.Fatal("ListAll fallback should not be used for runtime price fetch")
	}
	if keyProvider.quoteCount != 0 {
		t.Fatalf("expected key-required provider to be skipped without key, got quoteCount=%d", keyProvider.quoteCount)
	}
}
