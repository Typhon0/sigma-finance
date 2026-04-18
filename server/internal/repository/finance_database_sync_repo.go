package repository

import (
	"context"
	"database/sql"
	"errors"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/uptrace/bun"
)

type IFinanceDatabaseSyncSettingRepository interface {
	IRepository[model.FinanceDatabaseSyncSetting]
	GetAll(ctx context.Context) ([]model.FinanceDatabaseSyncSetting, error)
	Upsert(ctx context.Context, setting *model.FinanceDatabaseSyncSetting) (*model.FinanceDatabaseSyncSetting, error)
}

type IFinanceDatabaseSyncHistoryRepository interface {
	IRepository[model.FinanceDatabaseSyncHistory]
	List(ctx context.Context, limit int) ([]model.FinanceDatabaseSyncHistory, error)
	Create(ctx context.Context, history *model.FinanceDatabaseSyncHistory) (*model.FinanceDatabaseSyncHistory, error)
}

type FinanceDatabaseSyncSettingRepository struct {
	*Repository[model.FinanceDatabaseSyncSetting]
}

func NewFinanceDatabaseSyncSettingRepository(db bun.IDB) *FinanceDatabaseSyncSettingRepository {
	return &FinanceDatabaseSyncSettingRepository{Repository: NewRepository[model.FinanceDatabaseSyncSetting](db)}
}

func (r *FinanceDatabaseSyncSettingRepository) GetByID(ctx context.Context, assetType string) (*model.FinanceDatabaseSyncSetting, error) {
	var setting model.FinanceDatabaseSyncSetting
	err := r.db.NewSelect().
		Model(&setting).
		Where("asset_type = ?", assetType).
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &setting, nil
}

func (r *FinanceDatabaseSyncSettingRepository) GetAll(ctx context.Context) ([]model.FinanceDatabaseSyncSetting, error) {
	var settings []model.FinanceDatabaseSyncSetting
	err := r.db.NewSelect().Model(&settings).Order("asset_type ASC").Scan(ctx)
	return settings, err
}

func (r *FinanceDatabaseSyncSettingRepository) Upsert(ctx context.Context, setting *model.FinanceDatabaseSyncSetting) (*model.FinanceDatabaseSyncSetting, error) {
	now := time.Now()
	if setting.CreatedAt.IsZero() {
		setting.CreatedAt = now
	}
	setting.UpdatedAt = now
	_, err := r.db.NewInsert().
		Model(setting).
		On("CONFLICT (asset_type) DO UPDATE").
		Set("is_enabled = EXCLUDED.is_enabled").
		Set("last_synced_at = EXCLUDED.last_synced_at").
		Set("record_count = EXCLUDED.record_count").
		Set("sync_status = EXCLUDED.sync_status").
		Set("progress = EXCLUDED.progress").
		Set("current_record = EXCLUDED.current_record").
		Set("error_message = EXCLUDED.error_message").
		Set("updated_at = EXCLUDED.updated_at").
		Returning("*").
		Exec(ctx)
	if err != nil {
		return nil, err
	}
	return setting, nil
}

type FinanceDatabaseSyncHistoryRepository struct {
	*Repository[model.FinanceDatabaseSyncHistory]
}

func NewFinanceDatabaseSyncHistoryRepository(db bun.IDB) *FinanceDatabaseSyncHistoryRepository {
	return &FinanceDatabaseSyncHistoryRepository{Repository: NewRepository[model.FinanceDatabaseSyncHistory](db)}
}

func (r *FinanceDatabaseSyncHistoryRepository) List(ctx context.Context, limit int) ([]model.FinanceDatabaseSyncHistory, error) {
	if limit <= 0 {
		limit = 50
	}
	var history []model.FinanceDatabaseSyncHistory
	err := r.db.NewSelect().
		Model(&history).
		Order("timestamp DESC").
		Limit(limit).
		Scan(ctx)
	return history, err
}

func (r *FinanceDatabaseSyncHistoryRepository) Create(ctx context.Context, history *model.FinanceDatabaseSyncHistory) (*model.FinanceDatabaseSyncHistory, error) {
	now := time.Now()
	if history.Timestamp.IsZero() {
		history.Timestamp = now
	}
	if history.CreatedAt.IsZero() {
		history.CreatedAt = now
	}
	_, err := r.db.NewInsert().
		Model(history).
		Returning("*").
		Exec(ctx)
	if err != nil {
		return nil, err
	}
	return history, nil
}
