package repository

import (
	"context"
	"database/sql"
	"errors"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/lib/pq"
	"github.com/uptrace/bun"
)

type HistoricalDataBackfillJobFilter struct {
	Status   *string
	Provider *string
	UserID   *string
	Limit    int
	Offset   int
}

type IHistoricalDataBackfillJobRepository interface {
	IRepository[model.HistoricalDataBackfillJob]
	Create(ctx context.Context, job *model.HistoricalDataBackfillJob) (*model.HistoricalDataBackfillJob, error)
	GetByID(ctx context.Context, id string) (*model.HistoricalDataBackfillJob, error)
	GetLatestByPortfolioAsset(ctx context.Context, portfolioID string, assetID string) (*model.HistoricalDataBackfillJob, error)
	GetActiveByRequest(ctx context.Context, portfolioID, assetID, instrumentID, provider string, requestedFrom, requestedTo time.Time) (*model.HistoricalDataBackfillJob, error)
	ClaimNextRunnable(ctx context.Context, workerID string, leaseDuration time.Duration) (*model.HistoricalDataBackfillJob, error)
	RequeueStaleRunning(ctx context.Context, staleBefore time.Time) (int64, error)
	List(ctx context.Context, filter HistoricalDataBackfillJobFilter) ([]model.HistoricalDataBackfillJob, error)
}

type HistoricalDataBackfillJobRepository struct {
	*Repository[model.HistoricalDataBackfillJob]
}

func isUndefinedBackfillTableErr(err error) bool {
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		return string(pqErr.Code) == "42P01"
	}
	return false
}

func isUniqueViolationErr(err error) bool {
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		return string(pqErr.Code) == "23505"
	}
	return false
}

func NewHistoricalDataBackfillJobRepository(db bun.IDB) *HistoricalDataBackfillJobRepository {
	return &HistoricalDataBackfillJobRepository{Repository: NewRepository[model.HistoricalDataBackfillJob](db)}
}

func (r *HistoricalDataBackfillJobRepository) Create(ctx context.Context, job *model.HistoricalDataBackfillJob) (*model.HistoricalDataBackfillJob, error) {
	now := time.Now().UTC()
	if job.CreatedAt.IsZero() {
		job.CreatedAt = now
	}
	_, err := r.db.NewInsert().Model(job).Returning("*").Exec(ctx)
	if err != nil {
		if isUndefinedBackfillTableErr(err) {
			return nil, ErrNotFound
		}
		if isUniqueViolationErr(err) {
			activeJob, activeErr := r.GetActiveByRequest(
				ctx,
				job.PortfolioID,
				job.AssetID,
				job.InstrumentID,
				job.Provider,
				job.RequestedFrom,
				job.RequestedTo,
			)
			if activeErr == nil && activeJob != nil {
				return activeJob, nil
			}
		}
		return nil, err
	}
	return job, nil
}

func (r *HistoricalDataBackfillJobRepository) GetLatestByPortfolioAsset(ctx context.Context, portfolioID string, assetID string) (*model.HistoricalDataBackfillJob, error) {
	var job model.HistoricalDataBackfillJob
	err := r.db.NewSelect().
		Model(&job).
		Where("portfolio_id = ?", portfolioID).
		Where("asset_id = ?", assetID).
		Order("created_at DESC").
		Limit(1).
		Scan(ctx)
	if err != nil {
		if isUndefinedBackfillTableErr(err) {
			return nil, ErrNotFound
		}
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &job, nil
}

func (r *HistoricalDataBackfillJobRepository) List(ctx context.Context, filter HistoricalDataBackfillJobFilter) ([]model.HistoricalDataBackfillJob, error) {
	limit := filter.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	q := r.db.NewSelect().
		Model((*model.HistoricalDataBackfillJob)(nil)).
		Order("created_at DESC").
		Limit(limit).
		Offset(func() int {
			if filter.Offset < 0 {
				return 0
			}
			return filter.Offset
		}())
	if filter.Status != nil && *filter.Status != "" {
		q.Where("status = ?", *filter.Status)
	}
	if filter.Provider != nil && *filter.Provider != "" {
		q.Where("provider = ?", *filter.Provider)
	}
	if filter.UserID != nil && *filter.UserID != "" {
		q.Where("user_id = ?", *filter.UserID)
	}
	var rows []model.HistoricalDataBackfillJob
	err := q.Scan(ctx, &rows)
	if err != nil && isUndefinedBackfillTableErr(err) {
		return []model.HistoricalDataBackfillJob{}, nil
	}
	return rows, err
}

func (r *HistoricalDataBackfillJobRepository) GetActiveByRequest(ctx context.Context, portfolioID, assetID, instrumentID, provider string, requestedFrom, requestedTo time.Time) (*model.HistoricalDataBackfillJob, error) {
	var job model.HistoricalDataBackfillJob
	err := r.db.NewSelect().
		Model(&job).
		Where("portfolio_id = ?", portfolioID).
		Where("asset_id = ?", assetID).
		Where("instrument_id = ?", instrumentID).
		Where("provider = ?", provider).
		Where("requested_from = ?", requestedFrom.UTC()).
		Where("requested_to = ?", requestedTo.UTC()).
		Where("status IN (?)", bun.In([]string{string(model.HistoricalDataBackfillStatusQueued), string(model.HistoricalDataBackfillStatusRunning)})).
		Order("created_at DESC").
		Limit(1).
		Scan(ctx)
	if err != nil {
		if isUndefinedBackfillTableErr(err) {
			return nil, ErrNotFound
		}
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &job, nil
}

func (r *HistoricalDataBackfillJobRepository) ClaimNextRunnable(ctx context.Context, workerID string, leaseDuration time.Duration) (*model.HistoricalDataBackfillJob, error) {
	if leaseDuration <= 0 {
		leaseDuration = 90 * time.Second
	}

	var job model.HistoricalDataBackfillJob
	err := r.db.NewRaw(`
		WITH candidate AS (
			SELECT id
			FROM sigma_finance.historical_data_backfill_jobs
			WHERE status = 'QUEUED'
				AND next_run_at <= current_timestamp
			ORDER BY created_at ASC
			FOR UPDATE SKIP LOCKED
			LIMIT 1
		)
		UPDATE sigma_finance.historical_data_backfill_jobs j
		SET
			status = 'RUNNING',
			step = 'FETCH_PRICES',
			progress = CASE WHEN j.progress < 20 THEN 20 ELSE j.progress END,
			started_at = COALESCE(j.started_at, current_timestamp),
			error_code = NULL,
			error_message = NULL,
			locked_at = current_timestamp,
			locked_by = ?,
			heartbeat_at = current_timestamp,
			attempts = j.attempts + 1
		FROM candidate
		WHERE j.id = candidate.id
		RETURNING j.*;
	`, workerID).Scan(ctx, &job)
	if err != nil {
		if isUndefinedBackfillTableErr(err) {
			return nil, ErrNotFound
		}
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &job, nil
}

func (r *HistoricalDataBackfillJobRepository) RequeueStaleRunning(ctx context.Context, staleBefore time.Time) (int64, error) {
	res, err := r.db.NewUpdate().
		Model((*model.HistoricalDataBackfillJob)(nil)).
		Set("status = ?", string(model.HistoricalDataBackfillStatusQueued)).
		Set("step = ?", string(model.HistoricalDataBackfillStepQueued)).
		Set("progress = 0").
		Set("next_run_at = current_timestamp").
		Set("locked_at = NULL").
		Set("locked_by = NULL").
		Set("heartbeat_at = NULL").
		Set("error_code = NULL").
		Set("error_message = NULL").
		Where("status = ?", string(model.HistoricalDataBackfillStatusRunning)).
		Where("(heartbeat_at IS NULL AND locked_at IS NOT NULL AND locked_at < ?) OR (heartbeat_at IS NOT NULL AND heartbeat_at < ?)", staleBefore, staleBefore).
		Exec(ctx)
	if err != nil {
		if isUndefinedBackfillTableErr(err) {
			return 0, nil
		}
		return 0, err
	}
	rows, _ := res.RowsAffected()
	return rows, nil
}
