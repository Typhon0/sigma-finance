package graphql

import (
	"context"
	"errors"
	"fmt"
	"log"

	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/repository"
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

	var assets []*gqlModel.PortfolioAsset
	for _, domPa := range pa {
		gqlAsset, gqlErr := r.getAssetWithDetails(ctx, domPa.AssetID)
		if gqlErr != nil || gqlAsset == nil {
			log.Printf("buildPortfolioAssets: skipping asset %s in portfolio %s: err=%v, asset=%v", domPa.AssetID, portfolioID, gqlErr, gqlAsset)
			continue
		}
		avgPP := domPa.AveragePurchasePrice
		var currentVal *float64
		if cv := gqlAsset.GetCurrentValue(); cv != nil {
			v := domPa.Quantity * (*cv)
			currentVal = &v
		}
		assets = append(assets, &gqlModel.PortfolioAsset{
			Asset:                gqlAsset,
			Quantity:             domPa.Quantity,
			AveragePurchasePrice: &avgPP,
			CurrentValue:         currentVal,
		})
	}
	return assets
}
