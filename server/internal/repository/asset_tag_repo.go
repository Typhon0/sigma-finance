package repository

import (
	"context"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// IAssetTagRepository defines the interface for asset_tag data operations.
type IAssetTagRepository interface {
	Add(ctx context.Context, assetID, tagID string) error
	Remove(ctx context.Context, assetID, tagID string) error
	FindByAssetID(ctx context.Context, assetID string) ([]*model.AssetTag, error)
	FindByTagID(ctx context.Context, tagID string) ([]*model.AssetTag, error)
}

// AssetTagRepository implements IAssetTagRepository.
type AssetTagRepository struct {
	db bun.IDB
}

// NewAssetTagRepository creates a new AssetTagRepository.
func NewAssetTagRepository(db bun.IDB) *AssetTagRepository {
	return &AssetTagRepository{db: db}
}

// Add creates a new association between an asset and a tag.
func (r *AssetTagRepository) Add(ctx context.Context, assetID, tagID string) error {
	assetTag := &model.AssetTag{
		AssetID: assetID,
		TagID:   tagID,
	}
	_, err := r.db.NewInsert().Model(assetTag).Exec(ctx)
	return err
}

// Remove deletes an association between an asset and a tag.
func (r *AssetTagRepository) Remove(ctx context.Context, assetID, tagID string) error {
	_, err := r.db.NewDelete().
		Model((*model.AssetTag)(nil)).
		Where("asset_id = ? AND tag_id = ?", assetID, tagID).
		Exec(ctx)
	return err
}

// FindByAssetID finds all tags associated with a given asset.
func (r *AssetTagRepository) FindByAssetID(ctx context.Context, assetID string) ([]*model.AssetTag, error) {
	var assetTags []*model.AssetTag
	err := r.db.NewSelect().
		Model(&assetTags).
		Where("asset_id = ?", assetID).
		Scan(ctx)
	return assetTags, err
}

// FindByTagID finds all assets associated with a given tag.
func (r *AssetTagRepository) FindByTagID(ctx context.Context, tagID string) ([]*model.AssetTag, error) {
	var assetTags []*model.AssetTag
	err := r.db.NewSelect().
		Model(&assetTags).
		Where("tag_id = ?", tagID).
		Scan(ctx)
	return assetTags, err
}
