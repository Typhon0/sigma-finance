package repository

import (
	"context"
	"database/sql"
	"errors"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// ITagRepository defines the interface for tag repository operations.
type ITagRepository interface {
	IRepository[model.Tag]
	GetTaggedAssets(ctx context.Context, tagID string) ([]model.Asset, error)
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
func (r *TagRepository) GetTaggedAssets(ctx context.Context, tagID string) ([]model.Asset, error) {
	var assets []model.Asset
	err := r.db.NewSelect().
		Model(&assets).
		Join("JOIN sigma_finance.asset_tag ON asset_tag.asset_id = assets.id").
		Where("asset_tag.tag_id = ?", tagID).
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []model.Asset{}, nil // Return empty slice if no assets found for tag
		}
		return nil, err
	}
	return assets, nil
}
