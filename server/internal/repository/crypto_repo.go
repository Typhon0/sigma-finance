package repository

import (
	"context"
	"database/sql"
	"errors"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// ICryptoRepository defines the interface for crypto-specific repository operations
type ICryptoRepository interface {
	IRepository[model.Crypto]
}

// CryptoRepository wraps the generic repository with crypto-specific functionality
type CryptoRepository struct {
	*Repository[model.Crypto]
}

// NewCryptoRepository creates a new crypto repository
func NewCryptoRepository(db bun.IDB) *CryptoRepository {
	return &CryptoRepository{
		Repository: NewRepository[model.Crypto](db),
	}
}

// GetByID overrides the generic GetByID to use asset_id (the actual PK column)
func (r *CryptoRepository) GetByID(ctx context.Context, id string) (*model.Crypto, error) {
	var crypto model.Crypto
	err := r.GetDB().NewSelect().Model(&crypto).Where("asset_id = ?", id).Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &crypto, nil
}

// Delete overrides the generic Delete to use asset_id (the actual PK column)
func (r *CryptoRepository) Delete(ctx context.Context, id string) error {
	res, err := r.GetDB().NewDelete().Model((*model.Crypto)(nil)).Where("asset_id = ?", id).Exec(ctx)
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
// the crypto table uses asset_id as its primary key, not a separate id column
func (r *CryptoRepository) Create(ctx context.Context, entity *model.Crypto) (*model.Crypto, error) {
	err := r.GetDB().NewInsert().Model(entity).Returning("*").Scan(ctx, entity)
	return entity, err
}
