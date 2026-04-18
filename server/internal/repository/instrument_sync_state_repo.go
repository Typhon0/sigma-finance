package repository

import (
	"context"
	"database/sql"
	"errors"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

type IInstrumentSyncStateRepository interface {
	IRepository[model.InstrumentSyncState]
	Upsert(ctx context.Context, state *model.InstrumentSyncState) (*model.InstrumentSyncState, error)
}

type InstrumentSyncStateRepository struct {
	*Repository[model.InstrumentSyncState]
}

func NewInstrumentSyncStateRepository(db bun.IDB) *InstrumentSyncStateRepository {
	return &InstrumentSyncStateRepository{Repository: NewRepository[model.InstrumentSyncState](db)}
}

func (r *InstrumentSyncStateRepository) GetByID(ctx context.Context, instrumentID string) (*model.InstrumentSyncState, error) {
	var state model.InstrumentSyncState
	err := r.db.NewSelect().Model(&state).Where("instrument_id = ?", instrumentID).Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &state, nil
}

func (r *InstrumentSyncStateRepository) Upsert(ctx context.Context, state *model.InstrumentSyncState) (*model.InstrumentSyncState, error) {
	_, err := r.db.NewInsert().
		Model(state).
		On("CONFLICT (instrument_id) DO UPDATE").
		Set("last_sync_attempt = EXCLUDED.last_sync_attempt").
		Set("last_sync_success = EXCLUDED.last_sync_success").
		Set("sync_status = EXCLUDED.sync_status").
		Set("last_sync_source = EXCLUDED.last_sync_source").
		Set("sync_error_message = EXCLUDED.sync_error_message").
		Set("stale = EXCLUDED.stale").
		Set("verification_confidence = EXCLUDED.verification_confidence").
		Set("updated_at = EXCLUDED.updated_at").
		Returning("*").
		Exec(ctx)
	if err != nil {
		return nil, err
	}
	return state, nil
}
