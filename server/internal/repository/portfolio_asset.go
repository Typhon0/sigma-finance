package repository

import (
	"context"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// PortfolioAssetRepository defines the interface for portfolio-asset relationship operations.
// It extends the generic repository with domain-specific methods for managing portfolio-asset associations.
type PortfolioAssetRepository interface {
	IRepository[model.PortfolioAsset]

	// FindByPortfolioID retrieves all assets in a specific portfolio
	FindByPortfolioID(ctx context.Context, portfolioID int) ([]model.PortfolioAsset, error)

	// FindByAssetID retrieves all portfolios containing a specific asset
	FindByAssetID(ctx context.Context, assetID int) ([]model.PortfolioAsset, error)

	// FindByPortfolioAndAsset retrieves a specific portfolio-asset association
	FindByPortfolioAndAsset(ctx context.Context, portfolioID, assetID int) (model.PortfolioAsset, error)

	// UpdateQuantity updates the quantity of an asset in a portfolio
	UpdateQuantity(ctx context.Context, portfolioID, assetID int, quantity float64) error

	// UpdateAveragePurchasePrice updates the average purchase price of an asset in a portfolio
	UpdateAveragePurchasePrice(ctx context.Context, portfolioID, assetID int, avgPrice float64) error

	// UpdatePortfolioAsset updates both quantity and average purchase price
	UpdatePortfolioAsset(ctx context.Context, portfolioID, assetID int, quantity, avgPrice float64) error

	// DeleteByPortfolioAndAsset removes an asset from a portfolio
	DeleteByPortfolioAndAsset(ctx context.Context, portfolioID, assetID int) error

	// GetPortfolioAssets retrieves all assets with details for a portfolio
	GetPortfolioAssets(ctx context.Context, portfolioID int) ([]model.Asset, error)

	// GetPortfolioValue calculates the total value of a portfolio based on current prices
	GetPortfolioValue(ctx context.Context, portfolioID int) (float64, error)
}

// portfolioAssetRepository is the concrete implementation of PortfolioAssetRepository
type portfolioAssetRepository struct {
	*Repository[model.PortfolioAsset]
	assetRepo IRepository[model.Asset]
}

// NewPortfolioAssetRepository creates a new portfolio asset repository instance
func NewPortfolioAssetRepository(
	repo *Repository[model.PortfolioAsset],
	assetRepo IRepository[model.Asset],
) PortfolioAssetRepository {
	return &portfolioAssetRepository{
		Repository: repo,
		assetRepo:  assetRepo,
	}
}

// FindByPortfolioID retrieves all assets in a specific portfolio
func (r *portfolioAssetRepository) FindByPortfolioID(ctx context.Context, portfolioID int) ([]model.PortfolioAsset, error) {
	return r.FindAllBy(ctx, ByColumn("portfolio_id", portfolioID))
}

// FindByAssetID retrieves all portfolios containing a specific asset
func (r *portfolioAssetRepository) FindByAssetID(ctx context.Context, assetID int) ([]model.PortfolioAsset, error) {
	return r.FindAllBy(ctx, ByColumn("asset_id", assetID))
}

// FindByPortfolioAndAsset retrieves a specific portfolio-asset association
func (r *portfolioAssetRepository) FindByPortfolioAndAsset(ctx context.Context, portfolioID, assetID int) (model.PortfolioAsset, error) {
	return r.FindOneBy(ctx,
		ByColumn("portfolio_id", portfolioID),
		ByColumn("asset_id", assetID),
	)
}

// UpdateQuantity updates the quantity of an asset in a portfolio
func (r *portfolioAssetRepository) UpdateQuantity(ctx context.Context, portfolioID, assetID int, quantity float64) error {
	portfolioAsset, err := r.FindByPortfolioAndAsset(ctx, portfolioID, assetID)
	if err != nil {
		return err
	}

	portfolioAsset.Quantity = quantity
	return r.Update(ctx, &portfolioAsset)
}

// UpdateAveragePurchasePrice updates the average purchase price of an asset in a portfolio
func (r *portfolioAssetRepository) UpdateAveragePurchasePrice(ctx context.Context, portfolioID, assetID int, avgPrice float64) error {
	portfolioAsset, err := r.FindByPortfolioAndAsset(ctx, portfolioID, assetID)
	if err != nil {
		return err
	}

	portfolioAsset.AveragePurchasePrice = avgPrice
	return r.Update(ctx, &portfolioAsset)
}

// UpdatePortfolioAsset updates both quantity and average purchase price
func (r *portfolioAssetRepository) UpdatePortfolioAsset(ctx context.Context, portfolioID, assetID int, quantity, avgPrice float64) error {
	portfolioAsset, err := r.FindByPortfolioAndAsset(ctx, portfolioID, assetID)
	if err != nil {
		return err
	}

	portfolioAsset.Quantity = quantity
	portfolioAsset.AveragePurchasePrice = avgPrice
	return r.Update(ctx, &portfolioAsset)
}

// DeleteByPortfolioAndAsset removes an asset from a portfolio
func (r *portfolioAssetRepository) DeleteByPortfolioAndAsset(ctx context.Context, portfolioID, assetID int) error {
	// Find the portfolio asset first to ensure it exists
	_, err := r.FindByPortfolioAndAsset(ctx, portfolioID, assetID)
	if err != nil {
		return err
	}

	// Use a custom query option to delete by composite key
	portfolioAssets, err := r.FindAllBy(ctx,
		ByColumn("portfolio_id", portfolioID),
		ByColumn("asset_id", assetID),
	)
	if err != nil {
		return err
	}

	if len(portfolioAssets) == 0 {
		return ErrNotFound
	}

	// Use the GetDB method to access the database connection
	db := r.Repository.GetDB()
	res, err := db.NewDelete().
		Model((*model.PortfolioAsset)(nil)).
		Where("portfolio_id = ? AND asset_id = ?", portfolioID, assetID).
		Exec(ctx)
	if err != nil {
		return err
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// GetPortfolioAssets retrieves all assets with details for a portfolio
func (r *portfolioAssetRepository) GetPortfolioAssets(ctx context.Context, portfolioID int) ([]model.Asset, error) {
	// Get portfolio asset associations
	portfolioAssets, err := r.FindByPortfolioID(ctx, portfolioID)
	if err != nil {
		return nil, err
	}

	if len(portfolioAssets) == 0 {
		return []model.Asset{}, nil
	}

	// Extract asset IDs
	assetIDs := make([]int, len(portfolioAssets))
	for i, pa := range portfolioAssets {
		assetIDs[i] = pa.AssetID
	}

	// Get assets by IDs
	return r.assetRepo.FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Where("asset_id IN (?)", bun.In(assetIDs))
	})
}

// GetPortfolioValue calculates the total value of a portfolio based on current prices
func (r *portfolioAssetRepository) GetPortfolioValue(ctx context.Context, portfolioID int) (float64, error) {
	portfolioAssets, err := r.FindByPortfolioID(ctx, portfolioID)
	if err != nil {
		return 0, err
	}

	var totalValue float64
	for _, pa := range portfolioAssets {
		// For now, we'll use the average purchase price as the current price
		// In a real implementation, you would fetch current market prices
		assetValue := pa.Quantity * pa.AveragePurchasePrice
		totalValue += assetValue
	}

	return totalValue, nil
}
