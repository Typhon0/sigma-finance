package repository

import (
	"context"
	"database/sql"
	"errors"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/uptrace/bun"
)

type ICatalogSyncRunRepository interface {
	IRepository[model.CatalogSyncRun]
	Create(ctx context.Context, run *model.CatalogSyncRun) (*model.CatalogSyncRun, error)
	Update(ctx context.Context, run *model.CatalogSyncRun) error
	GetLatestBySource(ctx context.Context, source string) (*model.CatalogSyncRun, error)
}

type CatalogSyncRunRepository struct {
	*Repository[model.CatalogSyncRun]
}

func NewCatalogSyncRunRepository(db bun.IDB) *CatalogSyncRunRepository {
	return &CatalogSyncRunRepository{Repository: NewRepository[model.CatalogSyncRun](db)}
}

func (r *CatalogSyncRunRepository) Create(ctx context.Context, run *model.CatalogSyncRun) (*model.CatalogSyncRun, error) {
	if run.StartedAt.IsZero() {
		run.StartedAt = time.Now()
	}
	_, err := r.db.NewInsert().Model(run).Returning("*").Exec(ctx)
	if err != nil {
		return nil, err
	}
	return run, nil
}

func (r *CatalogSyncRunRepository) Update(ctx context.Context, run *model.CatalogSyncRun) error {
	_, err := r.db.NewUpdate().
		Model(run).
		Column("status", "cursor", "stats_json", "error_text", "finished_at").
		WherePK().
		Exec(ctx)
	return err
}

func (r *CatalogSyncRunRepository) GetLatestBySource(ctx context.Context, source string) (*model.CatalogSyncRun, error) {
	var run model.CatalogSyncRun
	err := r.db.NewSelect().
		Model(&run).
		Where("source = ?", source).
		Order("started_at DESC").
		Limit(1).
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &run, nil
}
