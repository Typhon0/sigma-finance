package repository

import (
	"context"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// IPortfolioRepository defines the interface for portfolio-specific repository operations
type IPortfolioRepository interface {
	IRepository[model.Portfolio]
	GetPortfolioByName(ctx context.Context, userID string, name string) (*model.Portfolio, error)
	GetMaxSortOrder(ctx context.Context, userID string) (int, error)
}

// PortfolioRepository wraps the generic repository with portfolio-specific functionality
type PortfolioRepository struct {
	*Repository[model.Portfolio]
}

// NewPortfolioRepository creates a new portfolio repository
func NewPortfolioRepository(db bun.IDB) *PortfolioRepository {
	return &PortfolioRepository{
		Repository: NewRepository[model.Portfolio](db),
	}
}

// GetByID overrides the generic GetByID to use the correct primary key column
func (r *PortfolioRepository) GetByID(ctx context.Context, id uint) (model.Portfolio, error) {
	return r.FindOneBy(ctx, ByColumn("portfolio_id", id))
}

// Delete overrides the generic Delete to use the correct primary key column
func (r *PortfolioRepository) Delete(ctx context.Context, id uint) error {
	res, err := r.db.NewDelete().Model((*model.Portfolio)(nil)).Where("portfolio_id = ?", id).Exec(ctx)
	if err != nil {
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// GetPortfolioByName retrieves a portfolio by its name for a specific user.
// Uses optimized index on (user_id, name) for fast lookups
func (r *PortfolioRepository) GetPortfolioByName(ctx context.Context, userID string, name string) (*model.Portfolio, error) {
	var portfolio model.Portfolio
	err := r.db.NewSelect().
		Model(&portfolio).
		Where("user_id = ? AND name = ?", userID, name).
		Limit(1). // Optimize for single result
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return &portfolio, nil
}

// GetMaxSortOrder retrieves the maximum sort order for a user's portfolios.
// Uses optimized index on (user_id, sort_order) for fast aggregation
func (r *PortfolioRepository) GetMaxSortOrder(ctx context.Context, userID string) (int, error) {
	var maxSortOrder int
	err := r.db.NewSelect().
		ColumnExpr("COALESCE(MAX(sort_order), 0)").
		Model((*model.Portfolio)(nil)).
		Where("user_id = ?", userID).
		Scan(ctx, &maxSortOrder)
	if err != nil {
		return 0, err
	}
	return maxSortOrder, nil
}

// GetPortfoliosByUserOptimized retrieves portfolios for a user with optimized query patterns
func (r *PortfolioRepository) GetPortfoliosByUserOptimized(ctx context.Context, userID string, orderBy string, limit int, offset int) ([]model.Portfolio, error) {
	query := r.db.NewSelect().Model((*model.Portfolio)(nil)).Where("user_id = ?", userID)

	// Apply ordering with index optimization
	switch orderBy {
	case "name":
		query = query.Order("name ASC")
	case "name_desc":
		query = query.Order("name DESC")
	case "created":
		query = query.Order("created_at ASC")
	case "created_desc":
		query = query.Order("created_at DESC") // Uses idx_portfolio_created_at
	case "updated":
		query = query.Order("updated_at DESC") // Uses idx_portfolio_updated_at
	case "sort_order":
		query = query.Order("sort_order ASC") // Uses idx_portfolio_user_sort
	default:
		query = query.Order("sort_order ASC") // Default ordering
	}

	// Apply pagination
	if limit > 0 {
		query = query.Limit(limit)
	}
	if offset > 0 {
		query = query.Offset(offset)
	}

	var portfolios []model.Portfolio
	err := query.Scan(ctx, &portfolios)
	return portfolios, err
}

// CountPortfoliosByUser returns the total count of portfolios for a user
func (r *PortfolioRepository) CountPortfoliosByUser(ctx context.Context, userID string) (int, error) {
	count, err := r.db.NewSelect().
		Model((*model.Portfolio)(nil)).
		Where("user_id = ?", userID).
		Count(ctx)
	return count, err
}

// GetPortfoliosWithAssetCount retrieves portfolios with asset count for efficient loading
func (r *PortfolioRepository) GetPortfoliosWithAssetCount(ctx context.Context, userID string) ([]model.Portfolio, error) {
	var portfolios []model.Portfolio
	err := r.db.NewSelect().
		Model(&portfolios).
		ColumnExpr("portfolio.*").
		ColumnExpr("COALESCE(asset_count.count, 0) as asset_count").
		Join("LEFT JOIN (SELECT portfolio_id, COUNT(*) as count FROM sigma_finance.portfolio_asset GROUP BY portfolio_id) as asset_count ON portfolio.id = asset_count.portfolio_id").
		Where("portfolio.user_id = ?", userID).
		Order("portfolio.sort_order ASC").
		Scan(ctx)
	return portfolios, err
}
