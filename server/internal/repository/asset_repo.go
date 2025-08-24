package repository

import (
	"context"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// IAssetRepository defines the interface for asset repository operations.
type IAssetRepository interface {
	IRepository[model.Asset]
	GetAssetTypes(ctx context.Context) ([]model.AssetType, error)
	GetAssetsByTag(ctx context.Context, tagID int) ([]model.Asset, error)
}

// AssetRepository is the concrete implementation of IAssetRepository.
type AssetRepository struct {
	*Repository[model.Asset]
}

// NewAssetRepository creates a new AssetRepository.
func NewAssetRepository(db bun.IDB) *AssetRepository {
	return &AssetRepository{
		Repository: NewRepository[model.Asset](db),
	}
}

// GetAssetTypes retrieves all asset types.
func (r *AssetRepository) GetAssetTypes(ctx context.Context) ([]model.AssetType, error) {
	var assetTypes []model.AssetType
	err := r.db.NewSelect().Model(&assetTypes).Scan(ctx)
	if err != nil {
		return nil, err
	}
	return assetTypes, nil
}

// GetAssetsByTag retrieves all assets associated with a given tag.
func (r *AssetRepository) GetAssetsByTag(ctx context.Context, tagID int) ([]model.Asset, error) {
	var assets []model.Asset
	err := r.db.NewSelect().
		Model(&assets).
		Join("JOIN asset_tags at ON at.asset_id = asset.id").
		Where("at.tag_id = ?", tagID).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return assets, nil
}
