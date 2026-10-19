package repository

import (
	"context"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// ITaxLotRepository defines data access methods for tax lots
type ITaxLotRepository interface {
	IRepository[model.TaxLot]
	FindOpenByPositionID(ctx context.Context, positionID string) ([]*model.TaxLot, error)
	FindByPositionID(ctx context.Context, positionID string) ([]*model.TaxLot, error)
	FindByPortfolioID(ctx context.Context, portfolioID string) ([]*model.TaxLot, error)
	UpdateBatch(ctx context.Context, lots []*model.TaxLot) error
}

// TaxLotRepository implements ITaxLotRepository using Bun
type TaxLotRepository struct {
	*Repository[model.TaxLot]
}

// NewTaxLotRepository creates a new TaxLotRepository instance
func NewTaxLotRepository(db bun.IDB) *TaxLotRepository {
	return &TaxLotRepository{
		Repository: NewRepository[model.TaxLot](db),
	}
}

// FindOpenByPositionID retrieves all active lots with remaining quantity
func (r *TaxLotRepository) FindOpenByPositionID(ctx context.Context, positionID string) ([]*model.TaxLot, error) {
	var lots []*model.TaxLot
	err := r.GetDB().NewSelect().
		Model(&lots).
		Where("position_id = ?", positionID).
		Where("remaining_quantity > 0").
		Where("status IN (?)", bun.In([]model.TaxLotStatus{model.TaxLotStatusOpen, model.TaxLotStatusPartiallyClosed})).
		Order("acquired_at ASC").
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return lots, nil
}

// FindByPositionID retrieves all lots (open and closed) for a position
func (r *TaxLotRepository) FindByPositionID(ctx context.Context, positionID string) ([]*model.TaxLot, error) {
	var lots []*model.TaxLot
	err := r.GetDB().NewSelect().
		Model(&lots).
		Where("position_id = ?", positionID).
		Order("acquired_at DESC").
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return lots, nil
}

// FindByPortfolioID retrieves all lots for a portfolio
func (r *TaxLotRepository) FindByPortfolioID(ctx context.Context, portfolioID string) ([]*model.TaxLot, error) {
	var lots []*model.TaxLot
	err := r.GetDB().NewSelect().
		Model(&lots).
		Where("portfolio_id = ?", portfolioID).
		Order("acquired_at DESC").
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return lots, nil
}

// UpdateBatch persists updates across a slice of tax lots
func (r *TaxLotRepository) UpdateBatch(ctx context.Context, lots []*model.TaxLot) error {
	if len(lots) == 0 {
		return nil
	}
	for _, lot := range lots {
		if err := r.Update(ctx, lot); err != nil {
			return err
		}
	}
	return nil
}
