package repository

import (
	"context"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// IPortfolioRepository defines the interface for portfolio-specific repository operations
type IPortfolioRepository interface {
	IRepository[model.Portfolio]
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
