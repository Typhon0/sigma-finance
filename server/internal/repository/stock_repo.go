package repository

import (
	"context"
	"database/sql"
	"errors"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// IStockRepository defines the interface for stock-specific repository operations
type IStockRepository interface {
	IRepository[model.Stock]
}

// StockRepository wraps the generic repository with stock-specific functionality
type StockRepository struct {
	*Repository[model.Stock]
}

// NewStockRepository creates a new stock repository
func NewStockRepository(db bun.IDB) *StockRepository {
	return &StockRepository{
		Repository: NewRepository[model.Stock](db),
	}
}

// GetByID overrides the generic GetByID to use asset_id (the actual PK column)
func (r *StockRepository) GetByID(ctx context.Context, id string) (*model.Stock, error) {
	var stock model.Stock
	err := r.GetDB().NewSelect().Model(&stock).Where("asset_id = ?", id).Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &stock, nil
}

// Delete overrides the generic Delete to use asset_id (the actual PK column)
func (r *StockRepository) Delete(ctx context.Context, id string) error {
	res, err := r.GetDB().NewDelete().Model((*model.Stock)(nil)).Where("asset_id = ?", id).Exec(ctx)
	if err != nil {
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// Create overrides the generic Create to not exclude 'id' column since
// the stock table uses asset_id as its primary key, not a separate id column
func (r *StockRepository) Create(ctx context.Context, entity *model.Stock) (*model.Stock, error) {
	err := r.GetDB().NewInsert().Model(entity).Returning("*").Scan(ctx, entity)
	return entity, err
}
