package repository

import (
	"context"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// ITagRepository defines the interface for tag repository operations.
type ITagRepository interface {
	IRepository[model.Tag]
	GetTaggedAssets(ctx context.Context, tagID int) ([]model.Asset, error)
}

// TagRepository is the concrete implementation of ITagRepository.
type TagRepository struct {
	*Repository[model.Tag]
}

// NewTagRepository creates a new TagRepository.
func NewTagRepository(db bun.IDB) *TagRepository {
	return &TagRepository{
		Repository: NewRepository[model.Tag](db),
	}
}

// GetTaggedAssets retrieves all assets associated with a specific tag.
func (r *TagRepository) GetTaggedAssets(ctx context.Context, tagID int) ([]model.Asset, error) {
	var assets []model.Asset
	err := r.db.NewSelect().
		Model(&assets).
		Join("JOIN asset_tags ON asset_tags.asset_id = asset.id").
		Where("asset_tags.tag_id = ?", tagID).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return assets, nil
}
