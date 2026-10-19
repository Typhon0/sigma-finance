// Package repository: tax lot disposition repository.
//
// A TaxLotDisposition is the persisted record of one lot-matched disposal:
// the FISCAL realized gain/loss (FIFO etc.), distinct from the economic P/L
// tracked on positions. These rows are the audit trail behind tax reporting.
package repository

import (
	"context"
	"time"

	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// ITaxLotDispositionRepository defines data access methods for tax lot dispositions
type ITaxLotDispositionRepository interface {
	Create(ctx context.Context, disposition *model.TaxLotDisposition) (*model.TaxLotDisposition, error)
	CreateBatch(ctx context.Context, dispositions []*model.TaxLotDisposition) error
	FindByPositionID(ctx context.Context, positionID string) ([]*model.TaxLotDisposition, error)
	FindByPortfolioID(ctx context.Context, portfolioID string) ([]*model.TaxLotDisposition, error)
	FindByPortfolioAndDateRange(ctx context.Context, portfolioID string, dateFrom, dateTo time.Time) ([]*model.TaxLotDisposition, error)
}

// TaxLotDispositionRepository implements ITaxLotDispositionRepository using Bun
type TaxLotDispositionRepository struct {
	*Repository[model.TaxLotDisposition]
}

// NewTaxLotDispositionRepository creates a new TaxLotDispositionRepository instance
func NewTaxLotDispositionRepository(db bun.IDB) *TaxLotDispositionRepository {
	return &TaxLotDispositionRepository{
		Repository: NewRepository[model.TaxLotDisposition](db),
	}
}

// Create persists a single disposition (inherited via generic Repository, kept explicit for interface clarity)

// CreateBatch persists a batch of dispositions in one insert
func (r *TaxLotDispositionRepository) CreateBatch(ctx context.Context, dispositions []*model.TaxLotDisposition) error {
	if len(dispositions) == 0 {
		return nil
	}
	_, err := r.GetDB().NewInsert().Model(&dispositions).Exec(ctx)
	return err
}

// FindByPositionID retrieves all dispositions for a position, oldest disposal first
func (r *TaxLotDispositionRepository) FindByPositionID(ctx context.Context, positionID string) ([]*model.TaxLotDisposition, error) {
	var dispositions []*model.TaxLotDisposition
	err := r.GetDB().NewSelect().
		Model(&dispositions).
		Where("position_id = ?", positionID).
		Order("sold_at ASC").
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return dispositions, nil
}

// FindByPortfolioID retrieves all dispositions for a portfolio, oldest disposal first
func (r *TaxLotDispositionRepository) FindByPortfolioID(ctx context.Context, portfolioID string) ([]*model.TaxLotDisposition, error) {
	var dispositions []*model.TaxLotDisposition
	err := r.GetDB().NewSelect().
		Model(&dispositions).
		Where("portfolio_id = ?", portfolioID).
		Order("sold_at ASC").
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return dispositions, nil
}

// FindByPortfolioAndDateRange retrieves dispositions for a portfolio within a tax year window
func (r *TaxLotDispositionRepository) FindByPortfolioAndDateRange(ctx context.Context, portfolioID string, dateFrom, dateTo time.Time) ([]*model.TaxLotDisposition, error) {
	var dispositions []*model.TaxLotDisposition
	err := r.GetDB().NewSelect().
		Model(&dispositions).
		Where("portfolio_id = ?", portfolioID).
		Where("sold_at >= ?", dateFrom).
		Where("sold_at < ?", dateTo).
		Order("sold_at ASC").
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return dispositions, nil
}
