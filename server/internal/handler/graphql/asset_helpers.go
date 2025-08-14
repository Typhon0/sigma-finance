package graphql

import (
	"context"
	"errors"
	"fmt"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/repository"
)

// getAssetWithDetails is a helper method to get asset with type-specific details
func (r *Resolver) getAssetWithDetails(ctx context.Context, assetID uint) (gqlModel.Asset, error) {
	// Get base asset
	asset, err := r.AssetService.GetByID(ctx, assetID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, nil // GraphQL convention: return nil for not found
		}
		return nil, fmt.Errorf("failed to get asset: %w", err)
	}

	// Get asset type
	assetType, err := r.AssetService.GetAssetTypeByID(ctx, uint(asset.AssetTypeID))
	if err != nil {
		return nil, fmt.Errorf("failed to get asset type: %w", err)
	}

	// Get tags
	tags, err := r.TagService.GetAssetTags(ctx, asset.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get asset tags: %w", err)
	}

	// Determine asset type and return appropriate concrete type
	switch assetType.Name {
	case "STOCK":
		stock, err := r.AssetService.GetStockByAssetID(ctx, assetID)
		if err != nil {
			return nil, fmt.Errorf("failed to get stock details: %w", err)
		}
		return mapStockToGQL(asset, stock, &assetType, tags), nil

	case "CRYPTO":
		crypto, err := r.AssetService.GetCryptoByAssetID(ctx, assetID)
		if err != nil {
			return nil, fmt.Errorf("failed to get crypto details: %w", err)
		}
		return mapCryptoToGQL(asset, crypto, &assetType, tags), nil

	default:
		// For other asset types, we would need to implement additional concrete types
		// For now, return an error
		return nil, fmt.Errorf("unsupported asset type: %s", assetType.Name)
	}
}
