package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/uptrace/bun"
)

type IProviderRoutingConfigRepository interface {
	Upsert(ctx context.Context, config *model.ProviderRoutingConfig) error
	GetByUserSymbolAssetType(ctx context.Context, userID, symbol, assetType string) (*model.ProviderRoutingConfig, error)
	ListByUser(ctx context.Context, userID string) ([]model.ProviderRoutingConfig, error)
	Delete(ctx context.Context, id string) error
}

type providerRoutingConfigRepository struct {
	db bun.IDB
}

func NewProviderRoutingConfigRepository(db bun.IDB) IProviderRoutingConfigRepository {
	return &providerRoutingConfigRepository{db: db}
}

func (r *providerRoutingConfigRepository) Upsert(ctx context.Context, config *model.ProviderRoutingConfig) error {
	existing, err := r.GetByUserSymbolAssetType(ctx, config.UserID, config.Symbol, config.AssetType)
	if err != nil {
		config.CreatedAt = config.UpdatedAt
		_, err = r.db.NewInsert().Model(config).Exec(ctx)
		return err
	}
	config.ID = existing.ID
	config.CreatedAt = existing.CreatedAt
	config.UpdatedAt = time.Now()
	_, err = r.db.NewUpdate().Model(config).WherePK().Exec(ctx)
	return err
}

func (r *providerRoutingConfigRepository) GetByUserSymbolAssetType(ctx context.Context, userID, symbol, assetType string) (*model.ProviderRoutingConfig, error) {
	var config model.ProviderRoutingConfig
	err := r.db.NewSelect().Model(&config).Where("user_id = ? AND symbol = ? AND asset_type = ?", userID, symbol, assetType).Scan(ctx)
	if err != nil {
		return nil, err
	}
	return &config, nil
}

func (r *providerRoutingConfigRepository) ListByUser(ctx context.Context, userID string) ([]model.ProviderRoutingConfig, error) {
	var configs []model.ProviderRoutingConfig
	err := r.db.NewSelect().Model(&configs).Where("user_id = ?", userID).Scan(ctx)
	return configs, err
}

func (r *providerRoutingConfigRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.NewDelete().Model(&model.ProviderRoutingConfig{}).Where("id = ?", id).Exec(ctx)
	return err
}
