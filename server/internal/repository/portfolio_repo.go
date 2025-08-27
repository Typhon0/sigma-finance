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
func (r *PortfolioRepository) GetPortfolioByName(ctx context.Context, userID string, name string) (*model.Portfolio, error) {
	var portfolio model.Portfolio
	err := r.db.NewSelect().Model(&portfolio).Where("user_id = ? AND name = ?", userID, name).Scan(ctx)
	if err != nil {
		return nil, err
	}
	return &portfolio, nil
}

// GetMaxSortOrder retrieves the maximum sort order for a user's portfolios.
func (r *PortfolioRepository) GetMaxSortOrder(ctx context.Context, userID string) (int, error) {
	var maxSortOrder int
	err := r.db.NewSelect().ColumnExpr("COALESCE(MAX(sort_order), 0)").Model((*model.Portfolio)(nil)).Where("user_id = ?", userID).Scan(ctx, &maxSortOrder)
	if err != nil {
		return 0, err
	}
	return maxSortOrder, nil
}
