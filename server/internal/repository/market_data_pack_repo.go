package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"strings"
	"time"

	"github.com/uptrace/bun"
)

type IMarketDataPackRepository interface {
	ListInstalled(ctx context.Context) ([]model.MarketDataPack, error)
	Get(ctx context.Context, packID string) (*model.MarketDataPack, error)
	UpsertPack(ctx context.Context, pack *model.MarketDataPack) error
	DeletePack(ctx context.Context, packID string) error
	ReplaceCoverage(ctx context.Context, packID string, coverage []model.MarketDataPackCoverage) error
	ListCoverage(ctx context.Context, instrumentID string) ([]model.MarketDataPackCoverage, error)
	CreateJob(ctx context.Context, job *model.MarketDataPackJob) error
	UpdateJob(ctx context.Context, job *model.MarketDataPackJob) error
	GetJob(ctx context.Context, jobID string) (*model.MarketDataPackJob, error)
	CreateBuildJob(ctx context.Context, job *model.MarketDataPackBuildJob) error
	UpdateBuildJob(ctx context.Context, job *model.MarketDataPackBuildJob) error
	GetBuildJob(ctx context.Context, jobID string) (*model.MarketDataPackBuildJob, error)
	ListBuildJobsByUser(ctx context.Context, userID string, limit int) ([]model.MarketDataPackBuildJob, error)
	ListBuildJobsForResume(ctx context.Context, staleRunningBefore time.Time) ([]model.MarketDataPackBuildJob, error)
	CreateBuildJobItems(ctx context.Context, items []model.MarketDataPackBuildJobItem) error
	UpdateBuildJobItem(ctx context.Context, item *model.MarketDataPackBuildJobItem) error
	ListBuildJobItems(ctx context.Context, jobID string) ([]model.MarketDataPackBuildJobItem, error)
	ListBuildJobItemsByUser(ctx context.Context, userID string, jobID string) ([]model.MarketDataPackBuildJobItem, error)
	ListBuildJobItemsByStatus(ctx context.Context, jobID string, statuses ...string) ([]model.MarketDataPackBuildJobItem, error)
	ListUserBuildUniverse(ctx context.Context, userID string, assetTypes []string) ([]LocalBuildInstrumentCandidate, error)
	ListInstrumentsByIDs(ctx context.Context, ids []string, assetTypes []string) ([]LocalBuildInstrumentCandidate, error)
	ListProviderSymbolMappings(ctx context.Context, provider string, instrumentIDs []string) (map[string]string, error)
	GetUserCredentialForProvider(ctx context.Context, userID string, provider string) (*model.MarketDataCredential, error)
}

type MarketDataPackRepository struct {
	db bun.IDB
}

type LocalBuildInstrumentCandidate struct {
	InstrumentID  string `bun:"instrument_id"`
	Symbol        string `bun:"symbol"`
	AssetType     string `bun:"asset_type"`
	QuoteCurrency string `bun:"quote_currency"`
	Priority      int    `bun:"priority"`
}

func NewMarketDataPackRepository(db bun.IDB) *MarketDataPackRepository {
	return &MarketDataPackRepository{db: db}
}

func (r *MarketDataPackRepository) ListInstalled(ctx context.Context) ([]model.MarketDataPack, error) {
	var packs []model.MarketDataPack
	err := r.db.NewSelect().Model(&packs).
		Where("status <> ?", "removed").
		Order("pack_priority DESC", "created_at DESC").
		Scan(ctx)
	return packs, err
}

func (r *MarketDataPackRepository) Get(ctx context.Context, packID string) (*model.MarketDataPack, error) {
	var pack model.MarketDataPack
	err := r.db.NewSelect().Model(&pack).Where("id = ?", packID).Scan(ctx)
	if err != nil {
		return nil, err
	}
	return &pack, nil
}

func (r *MarketDataPackRepository) UpsertPack(ctx context.Context, pack *model.MarketDataPack) error {
	_, err := r.db.NewInsert().Model(pack).
		On("CONFLICT (id) DO UPDATE").
		Set("version = EXCLUDED.version").
		Set("name = EXCLUDED.name").
		Set("description = EXCLUDED.description").
		Set("format_version = EXCLUDED.format_version").
		Set("status = EXCLUDED.status").
		Set("parent_pack_id = EXCLUDED.parent_pack_id").
		Set("pack_priority = EXCLUDED.pack_priority").
		Set("file_path = EXCLUDED.file_path").
		Set("checksum = EXCLUDED.checksum").
		Set("signature_verified = EXCLUDED.signature_verified").
		Set("assets_count = EXCLUDED.assets_count").
		Set("rows_count = EXCLUDED.rows_count").
		Set("installed_at = EXCLUDED.installed_at").
		Set("updated_at = EXCLUDED.updated_at").
		Exec(ctx)
	return err
}

func (r *MarketDataPackRepository) DeletePack(ctx context.Context, packID string) error {
	_, err := r.db.NewDelete().Model((*model.MarketDataPack)(nil)).
		Where("id = ?", packID).
		Exec(ctx)
	return err
}

func (r *MarketDataPackRepository) ReplaceCoverage(ctx context.Context, packID string, coverage []model.MarketDataPackCoverage) error {
	_, err := r.db.NewDelete().Model((*model.MarketDataPackCoverage)(nil)).
		Where("pack_id = ?", packID).
		Exec(ctx)
	if err != nil {
		return err
	}
	if len(coverage) == 0 {
		return nil
	}
	_, err = r.db.NewInsert().Model(&coverage).Exec(ctx)
	return err
}

func (r *MarketDataPackRepository) ListCoverage(ctx context.Context, instrumentID string) ([]model.MarketDataPackCoverage, error) {
	var coverage []model.MarketDataPackCoverage
	q := r.db.NewSelect().Model(&coverage).
		Order("last_date DESC", "pack_id DESC")
	if instrumentID != "" {
		q = q.Where("instrument_id = ?", instrumentID)
	}
	err := q.Scan(ctx)
	return coverage, err
}

func (r *MarketDataPackRepository) CreateJob(ctx context.Context, job *model.MarketDataPackJob) error {
	_, err := r.db.NewInsert().Model(job).Returning("*").Exec(ctx)
	return err
}

func (r *MarketDataPackRepository) UpdateJob(ctx context.Context, job *model.MarketDataPackJob) error {
	_, err := r.db.NewUpdate().Model(job).
		WherePK().
		Exec(ctx)
	return err
}

func (r *MarketDataPackRepository) GetJob(ctx context.Context, jobID string) (*model.MarketDataPackJob, error) {
	var job model.MarketDataPackJob
	err := r.db.NewSelect().Model(&job).Where("id = ?", jobID).Scan(ctx)
	if err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *MarketDataPackRepository) CreateBuildJob(ctx context.Context, job *model.MarketDataPackBuildJob) error {
	_, err := r.db.NewInsert().Model(job).Returning("*").Exec(ctx)
	return err
}

func (r *MarketDataPackRepository) UpdateBuildJob(ctx context.Context, job *model.MarketDataPackBuildJob) error {
	_, err := r.db.NewUpdate().Model(job).WherePK().Exec(ctx)
	return err
}

func (r *MarketDataPackRepository) GetBuildJob(ctx context.Context, jobID string) (*model.MarketDataPackBuildJob, error) {
	var job model.MarketDataPackBuildJob
	err := r.db.NewSelect().Model(&job).Where("id = ?", jobID).Scan(ctx)
	if err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *MarketDataPackRepository) ListBuildJobsByUser(ctx context.Context, userID string, limit int) ([]model.MarketDataPackBuildJob, error) {
	if limit <= 0 {
		limit = 20
	}
	var jobs []model.MarketDataPackBuildJob
	err := r.db.NewSelect().Model(&jobs).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Scan(ctx)
	return jobs, err
}

func (r *MarketDataPackRepository) ListBuildJobsForResume(ctx context.Context, staleRunningBefore time.Time) ([]model.MarketDataPackBuildJob, error) {
	var jobs []model.MarketDataPackBuildJob
	err := r.db.NewSelect().Model(&jobs).
		Where("status = ?", "queued").
		WhereOr("(status = ? AND started_at < ?)", "running", staleRunningBefore).
		Order("created_at ASC").
		Scan(ctx)
	return jobs, err
}

func (r *MarketDataPackRepository) CreateBuildJobItems(ctx context.Context, items []model.MarketDataPackBuildJobItem) error {
	if len(items) == 0 {
		return nil
	}
	_, err := r.db.NewInsert().Model(&items).
		On("CONFLICT (job_id, instrument_id) DO NOTHING").
		Exec(ctx)
	return err
}

func (r *MarketDataPackRepository) UpdateBuildJobItem(ctx context.Context, item *model.MarketDataPackBuildJobItem) error {
	_, err := r.db.NewUpdate().Model(item).WherePK().Exec(ctx)
	return err
}

func (r *MarketDataPackRepository) ListBuildJobItems(ctx context.Context, jobID string) ([]model.MarketDataPackBuildJobItem, error) {
	var items []model.MarketDataPackBuildJobItem
	err := r.db.NewSelect().Model(&items).
		Where("job_id = ?", jobID).
		Order("symbol ASC").
		Scan(ctx)
	return items, err
}

func (r *MarketDataPackRepository) ListBuildJobItemsByUser(ctx context.Context, userID string, jobID string) ([]model.MarketDataPackBuildJobItem, error) {
	var items []model.MarketDataPackBuildJobItem
	err := r.db.NewRaw(`
		SELECT i.*
		FROM sigma_finance.market_data_pack_build_job_items i
		JOIN sigma_finance.market_data_pack_build_jobs j ON j.id = i.job_id
		WHERE i.job_id = ?
		  AND j.user_id = ?
		ORDER BY i.symbol ASC
	`, jobID, userID).Scan(ctx, &items)
	return items, err
}

func (r *MarketDataPackRepository) ListBuildJobItemsByStatus(ctx context.Context, jobID string, statuses ...string) ([]model.MarketDataPackBuildJobItem, error) {
	var items []model.MarketDataPackBuildJobItem
	q := r.db.NewSelect().Model(&items).Where("job_id = ?", jobID)
	if len(statuses) > 0 {
		q = q.Where("status IN (?)", bun.In(statuses))
	}
	err := q.Order("symbol ASC").Scan(ctx)
	return items, err
}

func (r *MarketDataPackRepository) ListUserBuildUniverse(ctx context.Context, userID string, assetTypes []string) ([]LocalBuildInstrumentCandidate, error) {
	candidates := make([]LocalBuildInstrumentCandidate, 0, 256)
	normalizedTypes := normalizeAssetTypes(assetTypes)
	if len(normalizedTypes) == 0 {
		normalizedTypes = []string{"STOCK", "FUND"}
	}

	var positionRows []LocalBuildInstrumentCandidate
	if err := r.db.NewRaw(`
		SELECT DISTINCT
			i.id AS instrument_id,
			i.symbol,
			i.asset_type,
			COALESCE(NULLIF(i.quote_currency, ''), 'USD') AS quote_currency,
			1 AS priority
		FROM sigma_finance.transactions t
		JOIN sigma_finance.positions p ON p.id = t.position_id
		JOIN sigma_finance.assets a ON a.id = p.asset_id
		JOIN sigma_finance.instruments i ON i.id = a.instrument_id
		WHERE t.user_id = ?
		  AND i.asset_type IN (?)
		  AND i.status <> 'ARCHIVED'
	`, userID, bun.In(normalizedTypes)).Scan(ctx, &positionRows); err != nil {
		return nil, err
	}

	var currentRows []LocalBuildInstrumentCandidate
	if err := r.db.NewRaw(`
		SELECT DISTINCT
			i.id AS instrument_id,
			i.symbol,
			i.asset_type,
			COALESCE(NULLIF(i.quote_currency, ''), 'USD') AS quote_currency,
			0 AS priority
		FROM sigma_finance.positions p
		JOIN sigma_finance.assets a ON a.id = p.asset_id
		JOIN sigma_finance.portfolios pf ON pf.id = p.portfolio_id
		JOIN sigma_finance.instruments i ON i.id = a.instrument_id
		WHERE pf.user_id = ?
		  AND i.asset_type IN (?)
		  AND i.status <> 'ARCHIVED'
	`, userID, bun.In(normalizedTypes)).Scan(ctx, &currentRows); err != nil {
		return nil, err
	}

	var watchlistRows []LocalBuildInstrumentCandidate
	if err := r.db.NewRaw(`
		SELECT DISTINCT
			i.id AS instrument_id,
			i.symbol,
			i.asset_type,
			COALESCE(NULLIF(i.quote_currency, ''), 'USD') AS quote_currency,
			2 AS priority
		FROM sigma_finance.watchlist w
		JOIN sigma_finance.watchlist_asset wa ON wa.watchlist_id = w.id
		JOIN sigma_finance.assets a ON a.id = wa.asset_id
		JOIN sigma_finance.instruments i ON i.id = a.instrument_id
		WHERE w.user_id = ?
		  AND i.asset_type IN (?)
		  AND i.status <> 'ARCHIVED'
	`, userID, bun.In(normalizedTypes)).Scan(ctx, &watchlistRows); err != nil {
		return nil, err
	}

	candidates = append(candidates, currentRows...)
	candidates = append(candidates, positionRows...)
	candidates = append(candidates, watchlistRows...)
	return candidates, nil
}

func (r *MarketDataPackRepository) ListInstrumentsByIDs(ctx context.Context, ids []string, assetTypes []string) ([]LocalBuildInstrumentCandidate, error) {
	if len(ids) == 0 {
		return []LocalBuildInstrumentCandidate{}, nil
	}
	normalizedTypes := normalizeAssetTypes(assetTypes)
	if len(normalizedTypes) == 0 {
		normalizedTypes = []string{"STOCK", "FUND"}
	}
	var rows []LocalBuildInstrumentCandidate
	err := r.db.NewRaw(`
		SELECT
			i.id AS instrument_id,
			i.symbol,
			i.asset_type,
			COALESCE(NULLIF(i.quote_currency, ''), 'USD') AS quote_currency,
			3 AS priority
		FROM sigma_finance.instruments i
		WHERE i.id IN (?)
		  AND i.asset_type IN (?)
		  AND i.status <> 'ARCHIVED'
	`, bun.In(ids), bun.In(normalizedTypes)).Scan(ctx, &rows)
	return rows, err
}

func (r *MarketDataPackRepository) ListProviderSymbolMappings(ctx context.Context, provider string, instrumentIDs []string) (map[string]string, error) {
	out := make(map[string]string, len(instrumentIDs))
	if len(instrumentIDs) == 0 {
		return out, nil
	}
	type row struct {
		InstrumentID    string  `bun:"instrument_id"`
		ProviderSymbol  *string `bun:"provider_symbol"`
		ProviderAssetID string  `bun:"provider_asset_id"`
	}
	rows := make([]row, 0, len(instrumentIDs))
	err := r.db.NewRaw(`
		SELECT DISTINCT ON (m.instrument_id)
			m.instrument_id,
			m.provider_symbol,
			m.provider_asset_id
		FROM sigma_finance.instrument_provider_mappings m
		WHERE m.provider = ?
		  AND m.instrument_id IN (?)
		ORDER BY m.instrument_id, m.updated_at DESC
	`, strings.ToUpper(strings.TrimSpace(provider)), bun.In(instrumentIDs)).Scan(ctx, &rows)
	if err != nil {
		return nil, err
	}
	for _, item := range rows {
		if item.ProviderSymbol != nil && strings.TrimSpace(*item.ProviderSymbol) != "" {
			out[item.InstrumentID] = strings.TrimSpace(*item.ProviderSymbol)
			continue
		}
		if strings.TrimSpace(item.ProviderAssetID) != "" {
			out[item.InstrumentID] = strings.TrimSpace(item.ProviderAssetID)
		}
	}
	return out, nil
}

func normalizeAssetTypes(assetTypes []string) []string {
	out := make([]string, 0, len(assetTypes))
	seen := make(map[string]struct{}, len(assetTypes))
	for _, raw := range assetTypes {
		value := strings.ToUpper(strings.TrimSpace(raw))
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

func (r *MarketDataPackRepository) GetUserCredentialForProvider(ctx context.Context, userID string, provider string) (*model.MarketDataCredential, error) {
	var credential model.MarketDataCredential
	err := r.db.NewSelect().
		Model(&credential).
		Where("user_id = ?", userID).
		Where("provider = ?", strings.ToUpper(strings.TrimSpace(provider))).
		Where("is_enabled = ?", true).
		Order("priority ASC").
		Limit(1).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return &credential, nil
}
