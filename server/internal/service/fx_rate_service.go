package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"

	"github.com/shopspring/decimal"
)

var (
	// ErrFXRateNotFound indicates that no FX rate exists for the requested pair.
	ErrFXRateNotFound = errors.New("FX rate not found")

	// ErrFXRateStale indicates that the FX rate is stale and may not be accurate.
	ErrFXRateStale = errors.New("FX rate is stale")
)

// IFXRateService defines the interface for FX rate operations.
type IFXRateService interface {
	// Convert converts an amount from one currency to another using the latest rate.
	Convert(ctx context.Context, amount model.Money, from, to model.Currency) (*ConversionResult, error)

	// GetLatestRate retrieves the latest FX rate for a currency pair.
	GetLatestRate(ctx context.Context, base, quote model.Currency) (*model.FXRate, error)

	// GetHistoricalRate retrieves the FX rate for a currency pair at a specific date/time.
	GetHistoricalRate(ctx context.Context, base, quote model.Currency, date time.Time) (*model.FXRate, error)

	// ResolvePairs deduplicates required currency pairs from a list of positions.
	ResolvePairs(ctx context.Context, positions []model.Position) []model.CurrencyPair
}

// ConversionResult holds the result of a currency conversion with metadata.
type ConversionResult struct {
	OriginalAmount  model.Money
	ConvertedAmount model.Money
	Rate            decimal.Decimal
	FromCurrency    model.Currency
	ToCurrency      model.Currency
	IsStale         bool
	IsBridging      bool
	BridgeRate      *decimal.Decimal
	Source          string
	AsOf            time.Time
	Granularity     model.FXRateGranularity
}

// fxRateService implements IFXRateService.
type fxRateService struct {
	uow   repository.IUnitOfWork
	cache *FXRateCache
	ttl   int
}

// NewFXRateService creates a new FX rate service with the specified cache TTL.
func NewFXRateService(uow repository.IUnitOfWork, cacheTTLSeconds int) IFXRateService {
	return &fxRateService{
		uow:   uow,
		cache: NewFXRateCache(time.Duration(cacheTTLSeconds) * time.Second),
		ttl:   cacheTTLSeconds,
	}
}

// Convert converts amount from one currency to another using direct/inverse/USD bridge resolution.
func (s *fxRateService) Convert(ctx context.Context, amount model.Money, from, to model.Currency) (*ConversionResult, error) {
	if !from.IsValid() {
		return nil, fmt.Errorf("invalid source currency: %s", from)
	}
	if !to.IsValid() {
		return nil, fmt.Errorf("invalid target currency: %s", to)
	}

	if from == to {
		now := time.Now().UTC()
		one := decimal.NewFromInt(1)
		return &ConversionResult{
			OriginalAmount:  amount,
			ConvertedAmount: amount,
			Rate:            one,
			FromCurrency:    from,
			ToCurrency:      to,
			IsStale:         false,
			IsBridging:      false,
			Source:          "IDENTITY",
			AsOf:            now,
			Granularity:     model.FXRateGranularityMinute,
		}, nil
	}

	// Direct or inverse first.
	rate, err := s.GetLatestRate(ctx, from, to)
	if err == nil {
		return s.applyConversion(amount, from, to, rate, false)
	}
	if !errors.Is(err, ErrFXRateNotFound) {
		return nil, err
	}

	// Bridge via USD as fallback.
	bridgeResult, bridgeErr := s.tryBridgeConversion(ctx, amount, from, to)
	if bridgeErr != nil {
		return nil, fmt.Errorf("no direct/inverse rate for %s->%s and bridge failed: %w", from, to, bridgeErr)
	}

	return bridgeResult, nil
}

// GetLatestRate retrieves the latest FX rate from DB with direct+inverse resolution.
func (s *fxRateService) GetLatestRate(ctx context.Context, base, quote model.Currency) (*model.FXRate, error) {
	if base == quote {
		now := time.Now().UTC()
		return &model.FXRate{
			BaseCurrency:  base,
			QuoteCurrency: quote,
			Rate:          decimal.NewFromInt(1),
			AsOf:          now,
			Source:        "IDENTITY",
			Granularity:   model.FXRateGranularityMinute,
			IsStale:       false,
		}, nil
	}

	if cached := s.cache.Get(base, quote); cached != nil {
		return cached, nil
	}

	rateRepo := s.uow.FXRate()

	// Direct lookup.
	directRate, err := rateRepo.GetLatestRate(ctx, base, quote)
	if err == nil {
		s.cache.Set(directRate)
		return directRate, nil
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	// Inverse lookup (quote/base) and invert.
	inverseRate, inverseErr := rateRepo.GetLatestRate(ctx, quote, base)
	if inverseErr != nil {
		if errors.Is(inverseErr, sql.ErrNoRows) {
			return nil, ErrFXRateNotFound
		}
		return nil, inverseErr
	}
	if inverseRate.Rate.IsZero() {
		return nil, fmt.Errorf("inverse rate is zero for %s/%s", quote, base)
	}

	resolved := &model.FXRate{
		BaseCurrency:  base,
		QuoteCurrency: quote,
		Rate:          decimal.NewFromInt(1).Div(inverseRate.Rate),
		AsOf:          inverseRate.AsOf,
		Source:        fmt.Sprintf("%s(inverse)", inverseRate.Source),
		Granularity:   inverseRate.Granularity,
		IsStale:       inverseRate.IsStale,
	}
	s.cache.Set(resolved)
	return resolved, nil
}

// GetHistoricalRate retrieves a historical FX rate for direct+inverse pairs.
func (s *fxRateService) GetHistoricalRate(ctx context.Context, base, quote model.Currency, date time.Time) (*model.FXRate, error) {
	if base == quote {
		return &model.FXRate{
			BaseCurrency:  base,
			QuoteCurrency: quote,
			Rate:          decimal.NewFromInt(1),
			AsOf:          date,
			Source:        "IDENTITY",
			Granularity:   model.FXRateGranularityDay,
			IsStale:       false,
		}, nil
	}

	rateRepo := s.uow.FXRate()
	rate, err := rateRepo.GetHistoricalRate(ctx, base, quote, date)
	if err == nil {
		return rate, nil
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	inverseRate, inverseErr := rateRepo.GetHistoricalRate(ctx, quote, base, date)
	if inverseErr != nil {
		if errors.Is(inverseErr, sql.ErrNoRows) {
			return nil, ErrFXRateNotFound
		}
		return nil, inverseErr
	}
	if inverseRate.Rate.IsZero() {
		return nil, fmt.Errorf("inverse historical rate is zero for %s/%s", quote, base)
	}

	return &model.FXRate{
		BaseCurrency:  base,
		QuoteCurrency: quote,
		Rate:          decimal.NewFromInt(1).Div(inverseRate.Rate),
		AsOf:          inverseRate.AsOf,
		Source:        fmt.Sprintf("%s(inverse)", inverseRate.Source),
		Granularity:   inverseRate.Granularity,
		IsStale:       inverseRate.IsStale,
	}, nil
}

// ResolvePairs deduplicates required pairs for scheduler usage.
// It resolves each unique position quote currency to USD.
func (s *fxRateService) ResolvePairs(_ context.Context, positions []model.Position) []model.CurrencyPair {
	seen := make(map[string]struct{})
	pairs := make([]model.CurrencyPair, 0)

	for _, pos := range positions {
		if !pos.QuoteCurrency.IsValid() {
			continue
		}
		if pos.QuoteCurrency == model.CurrencyUSD {
			continue
		}
		key := pos.QuoteCurrency.String() + "/USD"
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		pairs = append(pairs, model.CurrencyPair{BaseCurrency: pos.QuoteCurrency, QuoteCurrency: model.CurrencyUSD})
	}

	return pairs
}

func (s *fxRateService) applyConversion(amount model.Money, from, to model.Currency, rate *model.FXRate, isBridging bool) (*ConversionResult, error) {
	amountDecimal := decimal.NewFromInt(int64(amount))
	convertedDecimal := amountDecimal.Mul(rate.Rate)
	convertedMoney := model.Money(convertedDecimal.Round(0).IntPart())

	result := &ConversionResult{
		OriginalAmount:  amount,
		ConvertedAmount: convertedMoney,
		Rate:            rate.Rate,
		FromCurrency:    from,
		ToCurrency:      to,
		IsStale:         rate.IsStale,
		IsBridging:      isBridging,
		Source:          rate.Source,
		AsOf:            rate.AsOf,
		Granularity:     rate.Granularity,
	}

	return result, nil
}

// tryBridgeConversion attempts FROM -> USD -> TO.
func (s *fxRateService) tryBridgeConversion(ctx context.Context, amount model.Money, from, to model.Currency) (*ConversionResult, error) {
	fromUSDRate, err := s.GetLatestRate(ctx, from, model.CurrencyUSD)
	if err != nil {
		return nil, fmt.Errorf("failed to get %s->USD rate: %w", from, err)
	}

	usdToRate, err := s.GetLatestRate(ctx, model.CurrencyUSD, to)
	if err != nil {
		return nil, fmt.Errorf("failed to get USD->%s rate: %w", to, err)
	}

	amountDecimal := decimal.NewFromInt(int64(amount))
	usdAmountDecimal := amountDecimal.Mul(fromUSDRate.Rate)
	convertedDecimal := usdAmountDecimal.Mul(usdToRate.Rate)
	convertedMoney := model.Money(convertedDecimal.Round(0).IntPart())
	combinedRate := fromUSDRate.Rate.Mul(usdToRate.Rate)

	asOf := fromUSDRate.AsOf
	if usdToRate.AsOf.Before(asOf) {
		asOf = usdToRate.AsOf
	}

	granularity := fromUSDRate.Granularity
	if granularity == "" {
		granularity = usdToRate.Granularity
	}
	if usdToRate.Granularity != "" && usdToRate.Granularity != granularity {
		// Use the coarser granularity for conservative provenance.
		if granularity == model.FXRateGranularityMinute || granularity == model.FXRateGranularityHour {
			granularity = usdToRate.Granularity
		}
	}

	return &ConversionResult{
		OriginalAmount:  amount,
		ConvertedAmount: convertedMoney,
		Rate:            combinedRate,
		FromCurrency:    from,
		ToCurrency:      to,
		IsStale:         fromUSDRate.IsStale || usdToRate.IsStale,
		IsBridging:      true,
		BridgeRate:      &combinedRate,
		Source:          fmt.Sprintf("%s+%s", fromUSDRate.Source, usdToRate.Source),
		AsOf:            asOf,
		Granularity:     granularity,
	}, nil
}
