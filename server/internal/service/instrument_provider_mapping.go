package service

import (
	"context"
	"fmt"
	"log"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"strings"
	"time"
)

type InstrumentProviderMappingService interface {
	GetVerifiedMapping(ctx context.Context, instrumentID string, provider string) (*model.InstrumentProviderMapping, error)
	EnsureDeterministicMapping(ctx context.Context, instrumentID string, provider string) (*model.InstrumentProviderMapping, error)
	ListMappings(ctx context.Context, instrumentID string) ([]model.InstrumentProviderMapping, error)
	InvalidateMapping(ctx context.Context, instrumentID string, provider string, reason string) error
}

type instrumentProviderMappingService struct {
	instrumentRepo repository.IInstrumentRepository
	mappingRepo    repository.IInstrumentProviderMappingRepository
}

func NewInstrumentProviderMappingService(uow repository.IUnitOfWork) InstrumentProviderMappingService {
	return &instrumentProviderMappingService{
		instrumentRepo: uow.Instrument(),
		mappingRepo:    uow.InstrumentProviderMapping(),
	}
}

func (s *instrumentProviderMappingService) GetVerifiedMapping(ctx context.Context, instrumentID string, provider string) (*model.InstrumentProviderMapping, error) {
	return s.mappingRepo.GetVerifiedByInstrumentAndProvider(ctx, instrumentID, strings.ToUpper(strings.TrimSpace(provider)))
}

func (s *instrumentProviderMappingService) EnsureDeterministicMapping(ctx context.Context, instrumentID string, provider string) (*model.InstrumentProviderMapping, error) {
	log.Printf("[InstrumentProviderMapping] EnsureDeterministicMapping: started instrument=%s provider=%s", instrumentID, provider)
	normalizedProvider := strings.ToUpper(strings.TrimSpace(provider))
	if normalizedProvider == "" {
		return nil, fmt.Errorf("provider is required")
	}

	if existing, err := s.mappingRepo.GetVerifiedByInstrumentAndProvider(ctx, instrumentID, normalizedProvider); err == nil && existing != nil {
		return existing, nil
	}

	instrument, err := s.instrumentRepo.GetByID(ctx, instrumentID)
	if err != nil {
		log.Printf("[InstrumentProviderMapping] EnsureDeterministicMapping: ERROR instrument not found instrument=%s: %v", instrumentID, err)
		return nil, err
	}
	providerAssetID, providerSymbol, providerMarket, quoteCurrency := deriveProviderIdentity(instrument, normalizedProvider)
	if strings.TrimSpace(providerAssetID) == "" {
		log.Printf("[InstrumentProviderMapping] EnsureDeterministicMapping: UNMAPPED instrument=%s provider=%s", instrumentID, normalizedProvider)
		mapping := &model.InstrumentProviderMapping{
			InstrumentID:    instrumentID,
			Provider:        normalizedProvider,
			ProviderAssetID: instrumentID,
			ProviderSymbol:  nil,
			ProviderMarket:  providerMarket,
			QuoteCurrency:   quoteCurrency,
			MappingStatus:   model.InstrumentProviderMappingStatusUnmapped,
			LastErrorText:   ptrString("deterministic mapping unavailable"),
		}
		if _, upsertErr := s.mappingRepo.Upsert(ctx, mapping); upsertErr != nil {
			return nil, upsertErr
		}
		return nil, repository.ErrNotFound
	}

	now := time.Now()
	mapping := &model.InstrumentProviderMapping{
		InstrumentID:    instrumentID,
		Provider:        normalizedProvider,
		ProviderAssetID: providerAssetID,
		ProviderSymbol:  providerSymbol,
		ProviderMarket:  providerMarket,
		QuoteCurrency:   quoteCurrency,
		MappingStatus:   model.InstrumentProviderMappingStatusVerified,
		LastVerifiedAt:  &now,
	}

	return s.mappingRepo.Upsert(ctx, mapping)
}

func (s *instrumentProviderMappingService) ListMappings(ctx context.Context, instrumentID string) ([]model.InstrumentProviderMapping, error) {
	return s.mappingRepo.ListByInstrument(ctx, instrumentID)
}

func (s *instrumentProviderMappingService) InvalidateMapping(ctx context.Context, instrumentID string, provider string, reason string) error {
	log.Printf("[InstrumentProviderMapping] InvalidateMapping: instrument=%s provider=%s reason=%s", instrumentID, provider, reason)
	return s.mappingRepo.Invalidate(ctx, instrumentID, provider, reason)
}

func deriveProviderIdentity(instrument *model.Instrument, provider string) (string, *string, *string, *string) {
	if instrument == nil {
		return "", nil, nil, nil
	}

	symbol := strings.ToUpper(strings.TrimSpace(instrument.Symbol))
	if symbol == "" {
		return "", nil, nil, nil
	}

	providerSymbol := symbol
	providerMarket := strings.TrimSpace(firstNonEmpty(
		stringOrEmpty(instrument.ExchangeCode),
		instrument.Exchange,
	))

	quoteCurrency := strings.ToUpper(strings.TrimSpace(firstNonEmpty(
		stringOrEmpty(instrument.QuoteCurrency),
		stringOrEmpty(instrument.Currency),
		"USD",
	)))

	if instrument.AssetType == model.InstrumentAssetTypeCrypto {
		switch provider {
		case "BINANCE":
			if !strings.HasSuffix(providerSymbol, "USDT") && !strings.Contains(providerSymbol, "/") && quoteCurrency == "USD" {
				providerSymbol = providerSymbol + "USDT"
				quoteCurrency = "USDT"
			}
		case "TWELVEDATA":
			if !strings.Contains(providerSymbol, "/") {
				providerSymbol = providerSymbol + "/" + quoteCurrency
			}
		}
	}

	providerAssetID := providerSymbol

	if instrument.ProviderExternalID != nil && strings.EqualFold(instrument.ProviderSource, provider) {
		providerAssetID = strings.TrimSpace(*instrument.ProviderExternalID)
	}

	return providerAssetID, ptrString(providerSymbol), ptrString(providerMarket), ptrString(quoteCurrency)
}

func stringOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}
