package repository

import (
	"context"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

type IInstrumentAliasRepository interface {
	IRepository[model.InstrumentAlias]
	FindByInstrumentID(ctx context.Context, instrumentID string) ([]model.InstrumentAlias, error)
	CreateBatch(ctx context.Context, aliases []model.InstrumentAlias) error
}

type InstrumentAliasRepository struct {
	*Repository[model.InstrumentAlias]
}

func NewInstrumentAliasRepository(db bun.IDB) *InstrumentAliasRepository {
	return &InstrumentAliasRepository{Repository: NewRepository[model.InstrumentAlias](db)}
}

func (r *InstrumentAliasRepository) FindByInstrumentID(ctx context.Context, instrumentID string) ([]model.InstrumentAlias, error) {
	return r.FindAllBy(ctx, ByColumn("instrument_id", instrumentID))
}

func (r *InstrumentAliasRepository) CreateBatch(ctx context.Context, aliases []model.InstrumentAlias) error {
	if len(aliases) == 0 {
		return nil
	}
	_, err := r.db.NewInsert().
		Model(&aliases).
		On("CONFLICT (instrument_id, normalized_alias_text, alias_type) DO NOTHING").
		Exec(ctx)
	return err
}
