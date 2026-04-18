package repository

import (
	"context"
	"database/sql"
	"errors"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// IFundRepository defines the interface for fund-specific repository operations
type IFundRepository interface {
	IRepository[model.Fund]
}

// FundRepository wraps the generic repository with fund-specific functionality
type FundRepository struct {
	*Repository[model.Fund]
}

// NewFundRepository creates a new fund repository
func NewFundRepository(db bun.IDB) *FundRepository {
	return &FundRepository{
		Repository: NewRepository[model.Fund](db),
	}
}

// GetByID overrides the generic GetByID to use asset_id (the actual PK column)
func (r *FundRepository) GetByID(ctx context.Context, id string) (*model.Fund, error) {
	var fund model.Fund
	err := r.GetDB().NewSelect().Model(&fund).Where("asset_id = ?", id).Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &fund, nil
}

// Delete overrides the generic Delete to use asset_id (the actual PK column)
func (r *FundRepository) Delete(ctx context.Context, id string) error {
	res, err := r.GetDB().NewDelete().Model((*model.Fund)(nil)).Where("asset_id = ?", id).Exec(ctx)
	if err != nil {
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}
