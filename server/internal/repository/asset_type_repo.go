package repository

import (
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// IAssetTypeRepository defines the interface for asset type-specific repository operations
type IAssetTypeRepository interface {
	IRepository[model.AssetType]
}

// AssetTypeRepository wraps the generic repository with asset type-specific functionality
type AssetTypeRepository struct {
	*Repository[model.AssetType]
}

// NewAssetTypeRepository creates a new asset type repository
func NewAssetTypeRepository(db bun.IDB) *AssetTypeRepository {
	return &AssetTypeRepository{
		Repository: NewRepository[model.AssetType](db),
	}
}
