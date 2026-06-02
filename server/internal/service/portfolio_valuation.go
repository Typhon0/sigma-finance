package service

import (
	"context"
	"fmt"
	"log"
	"sort"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"

	"github.com/shopspring/decimal"
)

type positionCostLot struct {
	Quantity decimal.Decimal
	Price    decimal.Decimal
	Currency model.Currency
}

// PositionValuation holds the calculated value of a single position in both native and display currency.
type PositionValuation struct {
	PositionID        string                  `json:"position_id"`
	AssetID           string                  `json:"asset_id"`
	NativeValue       model.Money             `json:"native_value"`
	DisplayValue      model.Money             `json:"display_value"`
	CostBasisNative   model.Money             `json:"cost_basis_native"`
	CostBasisDisplay  model.Money             `json:"cost_basis_display"`
	CostBasisCurrency model.Currency          `json:"cost_basis_currency"`
	FXRate            decimal.Decimal         `json:"fx_rate"`
	FXAsOf            *time.Time              `json:"fx_as_of,omitempty"`
	FXSource          string                  `json:"fx_source,omitempty"`
	FXGranularity     model.FXRateGranularity `json:"fx_granularity,omitempty"`
	IsStale           bool                    `json:"is_stale"`
	QuoteCurrency     model.Currency          `json:"quote_currency"`
	DisplayCurrency   model.Currency          `json:"display_currency"`
	IsExcluded        bool                    `json:"is_excluded"`
	ExclusionReason   string                  `json:"exclusion_reason,omitempty"`
	HasNativeValue    bool                    `json:"has_native_value"`
	HasDisplayValue   bool                    `json:"has_display_value"`
}

// PortfolioValuation holds the aggregated valuation of multiple positions.
type PortfolioValuation struct {
	TotalNativeValue        model.Money             `json:"total_native_value"`
	TotalDisplayValue       model.Money             `json:"total_display_value"`
	TotalDisplayCostBasis   model.Money             `json:"total_display_cost_basis"`
	TotalDisplayGainLoss    model.Money             `json:"total_display_gain_loss"`
	TotalDisplayGainLossPct decimal.Decimal         `json:"total_display_gain_loss_pct"`
	PerformanceHistory      []PerformancePoint      `json:"performance_history"`
	FXAsOf                  time.Time               `json:"fx_as_of"`
	FXSource                string                  `json:"fx_source"`
	FXGranularity           model.FXRateGranularity `json:"fx_granularity"`
	IsStale                 bool                    `json:"is_stale"`
	FXState                 string                  `json:"fx_state"`
	ExcludedPositionCount   int                     `json:"excluded_position_count"`
	CoveredValueRatio       decimal.Decimal         `json:"covered_value_ratio"`
	PositionValuations      []PositionValuation     `json:"position_valuations"`
	QuoteCurrency           model.Currency          `json:"quote_currency"`
	DisplayCurrency         model.Currency          `json:"display_currency"`
}

// IPortfolioValuationService defines the interface for portfolio valuation operations.
type IPortfolioValuationService interface {
	CalculatePositionValue(ctx context.Context, position model.Position, displayCurrency model.Currency) (*PositionValuation, error)
	CalculatePortfolioValue(ctx context.Context, positions []model.Position, displayCurrency model.Currency) (*PortfolioValuation, error)
}

// portfolioValuationService implements IPortfolioValuationService.
type portfolioValuationService struct {
	uow           repository.IUnitOfWork
	fxRateService IFXRateService
}

// NewPortfolioValuationService creates a new portfolio valuation service.
func NewPortfolioValuationService(uow repository.IUnitOfWork, fxRateService IFXRateService) IPortfolioValuationService {
	return &portfolioValuationService{uow: uow, fxRateService: fxRateService}
}

// CalculatePositionValue computes native and display currency values for a single position.
func (s *portfolioValuationService) CalculatePositionValue(ctx context.Context, position model.Position, displayCurrency model.Currency) (*PositionValuation, error) {
	valuation := &PositionValuation{
		PositionID:      position.ID,
		AssetID:         position.AssetID,
		FXRate:          decimal.NewFromInt(1),
		QuoteCurrency:   position.QuoteCurrency,
		DisplayCurrency: displayCurrency,
	}

	if !position.QuoteCurrency.IsValid() {
		valuation.IsExcluded = true
		valuation.ExclusionReason = "missing_or_invalid_quote_currency"
		log.Printf("[PortfolioValuation] CalculatePositionValue: SKIPPED position=%s reason=missing_quote_currency", position.ID)
		return valuation, nil
	}

	latestPrice, err := s.uow.AssetPrice().GetLatestPrice(ctx, position.AssetID)
	if err != nil {
		valuation.IsExcluded = true
		valuation.ExclusionReason = "missing_market_price"
		log.Printf("[PortfolioValuation] CalculatePositionValue: SKIPPED position=%s asset=%s reason=missing_market_price: %v", position.ID, position.AssetID, err)
		return valuation, nil
	}

	nativeValueDecimal := position.Quantity.Mul(latestPrice.Price).Mul(decimal.NewFromInt(100))
	valuation.NativeValue = model.Money(nativeValueDecimal.Round(0).IntPart())
	valuation.HasNativeValue = true

	costBasisByCurrency, costBasisErr := s.calculateRemainingCostBasisByCurrency(ctx, position)
	if costBasisErr == nil && len(costBasisByCurrency) > 0 {
		var displayCostBasis model.Money
		for currency, amount := range costBasisByCurrency {
			if !currency.IsValid() || amount == 0 {
				continue
			}
			if valuation.CostBasisCurrency == "" {
				valuation.CostBasisCurrency = currency
			}
			valuation.CostBasisNative += amount

			if currency == displayCurrency {
				displayCostBasis += amount
				continue
			}

			costBasisConversion, conversionErr := s.fxRateService.Convert(ctx, amount, currency, displayCurrency)
			if conversionErr != nil {
				continue
			}
			displayCostBasis += costBasisConversion.ConvertedAmount
			valuation.IsStale = valuation.IsStale || costBasisConversion.IsStale
			if valuation.FXSource == "" && costBasisConversion.Source != "" {
				valuation.FXSource = costBasisConversion.Source
			}
			if valuation.FXGranularity == "" && costBasisConversion.Granularity != "" {
				valuation.FXGranularity = costBasisConversion.Granularity
			}
			if valuation.FXAsOf == nil && !costBasisConversion.AsOf.IsZero() {
				asOf := costBasisConversion.AsOf
				valuation.FXAsOf = &asOf
			}
		}
		valuation.CostBasisDisplay = displayCostBasis
	}

	if valuation.CostBasisDisplay == 0 && position.TotalCostBasis != nil {
		// Fallback to legacy position cost basis when transaction history cannot reconstruct remaining lots.
		valuation.CostBasisNative = *position.TotalCostBasis
		valuation.CostBasisDisplay = *position.TotalCostBasis
		valuation.CostBasisCurrency = position.QuoteCurrency
		if valuation.CostBasisCurrency.IsValid() && valuation.CostBasisCurrency != displayCurrency {
			costBasisConversion, conversionErr := s.fxRateService.Convert(ctx, valuation.CostBasisNative, valuation.CostBasisCurrency, displayCurrency)
			if conversionErr == nil {
				valuation.CostBasisDisplay = costBasisConversion.ConvertedAmount
				valuation.IsStale = valuation.IsStale || costBasisConversion.IsStale
				if valuation.FXSource == "" && costBasisConversion.Source != "" {
					valuation.FXSource = costBasisConversion.Source
				}
				if valuation.FXGranularity == "" && costBasisConversion.Granularity != "" {
					valuation.FXGranularity = costBasisConversion.Granularity
				}
				if valuation.FXAsOf == nil && !costBasisConversion.AsOf.IsZero() {
					asOf := costBasisConversion.AsOf
					valuation.FXAsOf = &asOf
				}
			}
		}
	}

	conversion, err := s.fxRateService.Convert(ctx, valuation.NativeValue, position.QuoteCurrency, displayCurrency)
	if err != nil {
		valuation.IsExcluded = true
		valuation.ExclusionReason = "missing_fx_rate"
		log.Printf("[PortfolioValuation] CalculatePositionValue: ERROR FX conversion failed position=%s from=%s to=%s: %v", position.ID, position.QuoteCurrency, displayCurrency, err)
		return valuation, fmt.Errorf("FX conversion failed for position %s: %w", position.ID, err)
	}

	valuation.DisplayValue = conversion.ConvertedAmount
	valuation.HasDisplayValue = true
	valuation.FXRate = conversion.Rate
	valuation.IsStale = conversion.IsStale
	valuation.FXSource = conversion.Source
	valuation.FXGranularity = conversion.Granularity
	if !conversion.AsOf.IsZero() {
		asOf := conversion.AsOf
		valuation.FXAsOf = &asOf
	}

	return valuation, nil
}

// CalculatePortfolioValue computes aggregated native and display currency values for positions.
func (s *portfolioValuationService) CalculatePortfolioValue(ctx context.Context, positions []model.Position, displayCurrency model.Currency) (*PortfolioValuation, error) {
	log.Printf("[PortfolioValuation] CalculatePortfolioValue: started positions=%d displayCurrency=%s", len(positions), displayCurrency)
	if len(positions) == 0 {
		return &PortfolioValuation{
			DisplayCurrency:    displayCurrency,
			PositionValuations: []PositionValuation{},
			FXState:            "EMPTY",
			CoveredValueRatio:  decimal.Zero,
		}, nil
	}

	positionValuations := make([]PositionValuation, 0, len(positions))
	currencyCount := make(map[model.Currency]int)
	fxSources := make(map[string]struct{})
	fxGranularities := make(map[model.FXRateGranularity]struct{})

	var totalNativeValue model.Money
	var totalDisplayValue model.Money
	var totalDisplayCostBasis model.Money
	var totalCandidateNative model.Money
	var coveredNative model.Money
	var costBasisCoveredDisplayValue model.Money
	var excludedPositionCount int
	var mostRecentFXAsOf time.Time
	anyStale := false

	for _, pos := range positions {
		valuation, err := s.CalculatePositionValue(ctx, pos, displayCurrency)
		if err != nil {
			// Keep partial valuation behavior: include metadata, continue with other positions.
		}
		if valuation == nil {
			continue
		}

		positionValuations = append(positionValuations, *valuation)

		if valuation.HasNativeValue {
			totalNativeValue += valuation.NativeValue
			totalCandidateNative += valuation.NativeValue
		}
		if valuation.HasDisplayValue {
			totalDisplayValue += valuation.DisplayValue
			coveredNative += valuation.NativeValue
			if valuation.CostBasisDisplay > 0 {
				costBasisCoveredDisplayValue += valuation.DisplayValue
			}
		}
		totalDisplayCostBasis += valuation.CostBasisDisplay
		if valuation.IsExcluded {
			excludedPositionCount++
		}
		if valuation.IsStale {
			anyStale = true
		}
		if valuation.QuoteCurrency.IsValid() {
			currencyCount[valuation.QuoteCurrency]++
		}
		if valuation.FXSource != "" {
			fxSources[valuation.FXSource] = struct{}{}
		}
		if valuation.FXGranularity != "" {
			fxGranularities[valuation.FXGranularity] = struct{}{}
		}
		if valuation.FXAsOf != nil {
			if mostRecentFXAsOf.IsZero() || valuation.FXAsOf.After(mostRecentFXAsOf) {
				mostRecentFXAsOf = *valuation.FXAsOf
			}
		}
	}

	primaryQuoteCurrency := model.CurrencyUSD
	maxCount := 0
	for currency, count := range currencyCount {
		if count > maxCount {
			maxCount = count
			primaryQuoteCurrency = currency
		}
	}

	fxSource := ""
	for source := range fxSources {
		if fxSource == "" {
			fxSource = source
			continue
		}
		fxSource = "MIXED"
		break
	}

	fxGranularity := model.FXRateGranularity("")
	for granularity := range fxGranularities {
		if fxGranularity == "" {
			fxGranularity = granularity
			continue
		}
		if fxGranularity != granularity {
			fxGranularity = model.FXRateGranularity("MIXED")
			break
		}
	}

	fxState := "UNAVAILABLE"
	switch {
	case len(positionValuations) == 0:
		fxState = "EMPTY"
	case excludedPositionCount == 0:
		fxState = "FULL"
	case coveredNative > 0:
		fxState = "PARTIAL"
	default:
		fxState = "UNAVAILABLE"
	}

	coveredValueRatio := decimal.Zero
	if totalCandidateNative > 0 {
		coveredValueRatio = decimal.NewFromInt(int64(coveredNative)).Div(decimal.NewFromInt(int64(totalCandidateNative)))
	}
	totalDisplayGainLoss := totalDisplayValue - totalDisplayCostBasis
	totalDisplayGainLossPct := calculateGainLossPercent(totalDisplayGainLoss, totalDisplayCostBasis, totalDisplayValue, costBasisCoveredDisplayValue)

	log.Printf("[PortfolioValuation] CalculatePortfolioValue: SUCCESS positions=%d excluded=%d totalDisplay=%d fxState=%s displayCurrency=%s", len(positions), excludedPositionCount, totalDisplayValue, fxState, displayCurrency)

	return &PortfolioValuation{
		TotalNativeValue:        totalNativeValue,
		TotalDisplayValue:       totalDisplayValue,
		TotalDisplayCostBasis:   totalDisplayCostBasis,
		TotalDisplayGainLoss:    totalDisplayGainLoss,
		TotalDisplayGainLossPct: totalDisplayGainLossPct,
		FXAsOf:                  mostRecentFXAsOf,
		FXSource:                fxSource,
		FXGranularity:           fxGranularity,
		IsStale:                 anyStale,
		FXState:                 fxState,
		ExcludedPositionCount:   excludedPositionCount,
		CoveredValueRatio:       coveredValueRatio,
		PositionValuations:      positionValuations,
		QuoteCurrency:           primaryQuoteCurrency,
		DisplayCurrency:         displayCurrency,
	}, nil
}

// calculateGainLossPercent returns 0 when cost basis coverage is too low to produce a reliable percentage.
func calculateGainLossPercent(totalGainLoss, totalCostBasis, totalDisplayValue, costBasisCoveredDisplayValue model.Money) decimal.Decimal {
	if totalCostBasis <= 0 || totalDisplayValue <= 0 {
		return decimal.Zero
	}

	const minCostBasisCoverage = 0.8

	coverageRatio := decimal.NewFromInt(int64(costBasisCoveredDisplayValue)).
		Div(decimal.NewFromInt(int64(totalDisplayValue)))
	if coverageRatio.LessThan(decimal.NewFromFloat(minCostBasisCoverage)) {
		return decimal.Zero
	}

	return decimal.NewFromInt(int64(totalGainLoss)).
		Div(decimal.NewFromInt(int64(totalCostBasis))).
		Mul(decimal.NewFromInt(100))
}

func (s *portfolioValuationService) calculateRemainingCostBasisByCurrency(ctx context.Context, position model.Position) (map[model.Currency]model.Money, error) {
	if position.ID == "" {
		return map[model.Currency]model.Money{}, nil
	}

	transactions, err := s.uow.Transaction().FindByPositionID(ctx, position.ID)
	if err != nil {
		return nil, err
	}

	sort.SliceStable(transactions, func(i, j int) bool {
		if transactions[i].ExecutedAt.Equal(transactions[j].ExecutedAt) {
			if transactions[i].CreatedAt.Equal(transactions[j].CreatedAt) {
				return transactions[i].ID < transactions[j].ID
			}
			return transactions[i].CreatedAt.Before(transactions[j].CreatedAt)
		}
		return transactions[i].ExecutedAt.Before(transactions[j].ExecutedAt)
	})

	lots := make([]positionCostLot, 0, len(transactions))
	for _, tx := range transactions {
		switch tx.Type {
		case model.TransactionTypeBuy, model.TransactionTypeTransferIn:
			if tx.Quantity == nil || tx.UnitPriceAmount == nil || !tx.UnitPriceCurrency.IsValid() || tx.Quantity.IsZero() {
				continue
			}
			lots = append(lots, positionCostLot{
				Quantity: tx.Quantity.Abs(),
				Price:    *tx.UnitPriceAmount,
				Currency: tx.UnitPriceCurrency,
			})
		case model.TransactionTypeSell, model.TransactionTypeTransferOut:
			if tx.Quantity == nil || tx.Quantity.IsZero() {
				continue
			}
			remainingToSell := tx.Quantity.Abs()
			for remainingToSell.GreaterThan(decimal.Zero) && len(lots) > 0 {
				headLot := lots[0]
				if headLot.Quantity.LessThanOrEqual(remainingToSell) {
					remainingToSell = remainingToSell.Sub(headLot.Quantity)
					lots = lots[1:]
					continue
				}
				lots[0].Quantity = headLot.Quantity.Sub(remainingToSell)
				remainingToSell = decimal.Zero
			}
		default:
			continue
		}
	}

	totals := make(map[model.Currency]model.Money)
	for _, lot := range lots {
		if !lot.Currency.IsValid() || lot.Quantity.IsZero() {
			continue
		}
		cents := lot.Quantity.Mul(lot.Price).Mul(decimal.NewFromInt(100)).Round(0).IntPart()
		if cents <= 0 {
			continue
		}
		totals[lot.Currency] += model.Money(cents)
	}

	return totals, nil
}
