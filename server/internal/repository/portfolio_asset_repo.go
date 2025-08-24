package repository

import (
	"context"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// IPortfolioAssetRepository defines the interface for portfolio-asset specific repository operations
type IPortfolioAssetRepository interface {
	IRepository[model.PortfolioAsset]
	FindByPortfolioID(ctx context.Context, portfolioID int) ([]model.PortfolioAsset, error)
	FindByPortfolioAndAsset(ctx context.Context, portfolioID, assetID int) (*model.PortfolioAsset, error)
	UpdatePortfolioAsset(ctx context.Context, portfolioAsset *model.PortfolioAsset) error
	DeleteByPortfolioAndAsset(ctx context.Context, portfolioID, assetID int) error
	DeleteByPortfolioID(ctx context.Context, portfolioID uint) error
}

// PortfolioAssetRepository wraps the generic repository with portfolio-asset specific functionality
type PortfolioAssetRepository struct {
	*Repository[model.PortfolioAsset]
}

// NewPortfolioAssetRepository creates a new portfolio-asset repository
func NewPortfolioAssetRepository(db bun.IDB) *PortfolioAssetRepository {
	return &PortfolioAssetRepository{
		Repository: NewRepository[model.PortfolioAsset](db),
	}
}

// FindByPortfolioID retrieves all assets for a specific portfolio
func (r *PortfolioAssetRepository) FindByPortfolioID(ctx context.Context, portfolioID int) ([]model.PortfolioAsset, error) {
	return r.FindAllBy(ctx, ByColumn("portfolio_id", portfolioID))
}

// FindByPortfolioAndAsset retrieves a specific asset in a portfolio
func (r *PortfolioAssetRepository) FindByPortfolioAndAsset(ctx context.Context, portfolioID, assetID int) (*model.PortfolioAsset, error) {
	var portfolioAsset model.PortfolioAsset
	err := r.db.NewSelect().Model(&portfolioAsset).
		Where("portfolio_id = ?", portfolioID).
		Where("asset_id = ?", assetID).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return &portfolioAsset, nil
}

// UpdatePortfolioAsset updates a portfolio asset
func (r *PortfolioAssetRepository) UpdatePortfolioAsset(ctx context.Context, portfolioAsset *model.PortfolioAsset) error {
	_, err := r.db.NewUpdate().Model(portfolioAsset).WherePK().Exec(ctx)
	return err
}

// DeleteByPortfolioAndAsset deletes a specific asset from a portfolio
func (r *PortfolioAssetRepository) DeleteByPortfolioAndAsset(ctx context.Context, portfolioID, assetID int) error {
	_, err := r.db.NewDelete().Model((*model.PortfolioAsset)(nil)).
		Where("portfolio_id = ?", portfolioID).
		Where("asset_id = ?", assetID).
		Exec(ctx)
	return err
}

// DeleteByPortfolioID deletes all assets from a portfolio
func (r *PortfolioAssetRepository) DeleteByPortfolioID(ctx context.Context, portfolioID uint) error {
	_, err := r.db.NewDelete().Model((*model.PortfolioAsset)(nil)).
		Where("portfolio_id = ?", portfolioID).
		Exec(ctx)
	return err
}
