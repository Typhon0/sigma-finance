package graphql

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	"sigma_finance/internal/domain/model"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"
)

// getAssetWithDetails is a helper method to get asset with type-specific details
func (r *Resolver) getAssetWithDetails(ctx context.Context, assetID string) (gqlModel.Asset, error) {
	// Get base asset
	asset, err := r.AssetService.GetAsset(ctx, assetID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, nil // GraphQL convention: return nil for not found
		}
		return nil, fmt.Errorf("failed to get asset: %w", err)
	}

	// Get tags (non-fatal: continue with empty tags on error)
	tags, _ := r.TagService.GetAssetTags(ctx, asset.ID)

	// Fetch latest price for CurrentValue
	var currentValue *float64
	latestPrice, err := r.UOW.AssetPrice().GetLatestPrice(ctx, asset.ID)
	if err == nil && latestPrice != nil {
		cv, _ := latestPrice.Price.Float64()
		currentValue = &cv
	}

	// Compute day change for tradeable assets
	var dayChange, dayChangePercent *float64
	if asset.IsTradeable {
		stats, err := r.UOW.AssetPrice().GetPriceStatistics(ctx, asset.ID)
		if err == nil && stats != nil {
			dc, _ := stats.Change.Float64()
			dcp, _ := stats.ChangePercent.Float64()
			dayChange = &dc
			dayChangePercent = &dcp
		}
	}

	// Determine asset type and return appropriate concrete type
	switch asset.Type {
	case "STOCK":
		stockDetails, _ := r.UOW.Stock().GetByID(ctx, asset.ID)
		return mapStockToGQL(*asset, stockDetails, tags, dayChange, dayChangePercent, currentValue), nil

	case "CRYPTO":
		cryptoDetails, _ := r.UOW.Crypto().GetByID(ctx, asset.ID)
		return mapCryptoToGQL(*asset, cryptoDetails, tags, dayChange, dayChangePercent, currentValue), nil

	case "FUND":
		fundDetails, _ := r.UOW.Fund().GetByID(ctx, asset.ID)
		return mapFundToGQL(*asset, fundDetails, tags, dayChange, dayChangePercent, currentValue), nil

	case "BANK_ACCOUNT":
		return mapBankAccountToGQL(*asset, tags, dayChange, dayChangePercent, currentValue), nil

	case "REAL_ESTATE":
		return mapRealEstateToGQL(*asset, tags, dayChange, dayChangePercent, currentValue), nil

	case "LIFE_INSURANCE":
		return mapLifeInsuranceToGQL(*asset, tags, dayChange, dayChangePercent, currentValue), nil

	case "WATCH":
		return mapWatchToGQL(*asset, tags, dayChange, dayChangePercent, currentValue), nil

	case "LOAN":
		return mapLoanToGQL(*asset, tags, dayChange, dayChangePercent, currentValue), nil

	default:
		// Unsupported asset type: return nil without error so callers can skip gracefully
		return nil, nil
	}
}

// buildPortfolioAssets resolves all assets for a portfolio, skipping any whose
// details cannot be loaded. This prevents a nil Asset from violating the
// GraphQL schema's `asset: Asset!` (non-null) constraint, which would
// cascade-null the entire portfolios response.
func (r *Resolver) buildPortfolioAssets(ctx context.Context, portfolioID string) []*gqlModel.PortfolioAsset {
	pa, err := r.PortfolioService.GetPortfolioAssets(ctx, portfolioID)
	if err != nil || len(pa) == 0 {
		return nil
	}

	displayCurrency, displayCurrencyErr := r.getDisplayCurrencyFromContext(ctx)
	if displayCurrencyErr != nil || !displayCurrency.IsValid() {
		displayCurrency = model.CurrencyUSD
	}

	displayValueByAssetID := make(map[string]float64)
	quoteCurrencyByAssetID := make(map[string]model.Currency)
	analytics, analyticsErr := r.safeGetPortfolioAnalytics(ctx, portfolioID, displayCurrency)
	if analyticsErr == nil && analytics != nil {
		for _, pv := range analytics.PositionValuations {
			if pv.QuoteCurrency.IsValid() {
				quoteCurrencyByAssetID[pv.AssetID] = pv.QuoteCurrency
			}
			if !pv.HasDisplayValue {
				continue
			}
			displayValueByAssetID[pv.AssetID] += float64(pv.DisplayValue) / 100.0
		}
	}

	var assetIDs []string
	for _, domPa := range pa {
		assetIDs = append(assetIDs, domPa.AssetID)
	}

	prefetchedAssets, batchErr := r.getAssetsWithDetailsBatch(ctx, assetIDs)
	if batchErr != nil {
		log.Printf("buildPortfolioAssets: batch fetch failed for portfolio %s: %v", portfolioID, batchErr)
		// Fallback to empty map on error to let loop skip gracefully
		prefetchedAssets = make(map[string]gqlModel.Asset)
	}

	var assets []*gqlModel.PortfolioAsset
	for _, domPa := range pa {
		gqlAsset, ok := prefetchedAssets[domPa.AssetID]
		if !ok || gqlAsset == nil {
			log.Printf("buildPortfolioAssets: skipping asset %s in portfolio %s: not found in batch", domPa.AssetID, portfolioID)
			continue
		}
		avgPP := domPa.AveragePurchasePrice
		var currentVal *float64
		if convertedDisplayValue, ok := displayValueByAssetID[domPa.AssetID]; ok {
			v := convertedDisplayValue
			currentVal = &v
		} else if cv := gqlAsset.GetCurrentValue(); cv != nil {
			quoteCurrency := domPa.QuoteCurrency
			if !quoteCurrency.IsValid() {
				if inferred, ok := quoteCurrencyByAssetID[domPa.AssetID]; ok && inferred.IsValid() {
					quoteCurrency = inferred
				}
			}
			// Only fall back to raw quote value if it is already in display currency.
			// This avoids showing USD values with a EUR symbol when FX conversion is unavailable.
			if !quoteCurrency.IsValid() || quoteCurrency == displayCurrency {
				v := domPa.Quantity * (*cv)
				currentVal = &v
			}
		}
		quoteCurrencyStr := domPa.QuoteCurrency.String()
		assets = append(assets, &gqlModel.PortfolioAsset{
			Asset:                gqlAsset,
			InstrumentID:         domPa.InstrumentID,
			Quantity:             domPa.Quantity,
			AveragePurchasePrice: &avgPP,
			CurrentValue:         currentVal,
			DayChange:            gqlAsset.GetDayChange(),
			DayChangePercent:     gqlAsset.GetDayChangePercent(),
			QuoteCurrency:        &quoteCurrencyStr,
		})
	}
	return assets
}

func (r *Resolver) safeGetPortfolioAnalytics(ctx context.Context, portfolioID string, displayCurrency model.Currency) (analytics *service.PortfolioValuation, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			analytics = nil
			err = fmt.Errorf("portfolio analytics unavailable: %v", recovered)
		}
	}()

	return r.PortfolioService.GetPortfolioAnalytics(ctx, portfolioID, displayCurrency)
}

func (r *Resolver) buildGraphQLTransaction(ctx context.Context, tx *model.Transaction) *gqlModel.Transaction {
	if tx == nil || tx.PositionID == nil || strings.TrimSpace(*tx.PositionID) == "" {
		return nil
	}

	position, err := r.UOW.Position().GetByID(ctx, *tx.PositionID)
	if err != nil || position == nil {
		log.Printf("buildGraphQLTransaction: skipping transaction %s: position lookup failed err=%v", tx.ID, err)
		return nil
	}
	if strings.TrimSpace(position.PortfolioID) == "" || strings.TrimSpace(position.AssetID) == "" {
		log.Printf("buildGraphQLTransaction: skipping transaction %s: invalid position links portfolio=%q asset=%q", tx.ID, position.PortfolioID, position.AssetID)
		return nil
	}

	gqlAsset, gqlErr := r.getAssetWithDetails(ctx, position.AssetID)
	if gqlErr != nil || gqlAsset == nil {
		log.Printf("buildGraphQLTransaction: skipping transaction %s: asset lookup failed asset=%s err=%v", tx.ID, position.AssetID, gqlErr)
		return nil
	}

	portfolio, portfolioErr := r.UOW.Portfolio().GetByID(ctx, position.PortfolioID)
	if portfolioErr != nil || portfolio == nil {
		log.Printf("buildGraphQLTransaction: skipping transaction %s: portfolio lookup failed portfolio=%s err=%v", tx.ID, position.PortfolioID, portfolioErr)
		return nil
	}

	mapped := mapTransactionToGQL(*tx)
	mapped.Asset = gqlAsset
	mapped.Portfolio = mapPortfolioToGQL(*portfolio)
	return mapped
}
