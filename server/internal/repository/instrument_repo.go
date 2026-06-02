package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"sigma_finance/internal/domain/model"
	"sort"
	"strings"
	"time"

	"github.com/agnivade/levenshtein"
	"github.com/uptrace/bun"
)

type InstrumentSearchFilter struct {
	AssetTypes  []model.InstrumentAssetType
	Exchange    *string
	OwnerUserID *string
	Limit       int
	Offset      int
}

type ManualInstrumentFilter struct {
	Query           string
	AssetTypes      []model.InstrumentAssetType
	OwnerUserID     *string
	Limit           int
	Offset          int
	IncludeArchived bool
}

type InstrumentSearchRow struct {
	Instrument model.Instrument `bun:",embed"`
	Score      float64          `bun:"score"`
	AliasMatch *string          `bun:"alias_match"`
}

type IInstrumentRepository interface {
	IRepository[model.Instrument]
	GetBySymbolAndExchange(ctx context.Context, normalizedSymbol, exchange string, assetType model.InstrumentAssetType) (*model.Instrument, error)
	GetByProviderIdentity(ctx context.Context, providerSource string, providerExternalID string) (*model.Instrument, error)
	FindByExternalKey(ctx context.Context, externalSource, externalID string) (*model.Instrument, error)
	GetByGlobalIdentifier(ctx context.Context, field, value string) (*model.Instrument, error)
	SearchLocalInstruments(ctx context.Context, query string, filter InstrumentSearchFilter) ([]InstrumentSearchRow, error)
	Search(ctx context.Context, query string, filter InstrumentSearchFilter) ([]InstrumentSearchRow, error)
	ListManual(ctx context.Context, filter ManualInstrumentFilter) ([]model.Instrument, error)
	Upsert(ctx context.Context, instrument *model.Instrument) (*model.Instrument, error)
	UpsertCatalogInstrument(ctx context.Context, instrument *model.Instrument) (*model.Instrument, error)
}

type InstrumentRepository struct {
	*Repository[model.Instrument]
}

func NewInstrumentRepository(db bun.IDB) *InstrumentRepository {
	return &InstrumentRepository{Repository: NewRepository[model.Instrument](db)}
}

func (r *InstrumentRepository) GetBySymbolAndExchange(ctx context.Context, normalizedSymbol, exchange string, assetType model.InstrumentAssetType) (*model.Instrument, error) {
	var instrument model.Instrument
	err := r.db.NewSelect().
		Model(&instrument).
		Where("normalized_symbol = ?", normalizedSymbol).
		Where("exchange = ?", exchange).
		Where("asset_type = ?", assetType).
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &instrument, nil
}

func (r *InstrumentRepository) GetByProviderIdentity(ctx context.Context, providerSource string, providerExternalID string) (*model.Instrument, error) {
	var instrument model.Instrument
	err := r.db.NewSelect().
		Model(&instrument).
		Where("provider_source = ?", providerSource).
		Where("provider_external_id = ?", providerExternalID).
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &instrument, nil
}

func (r *InstrumentRepository) FindByExternalKey(ctx context.Context, externalSource, externalID string) (*model.Instrument, error) {
	var instrument model.Instrument
	err := r.db.NewSelect().
		Model(&instrument).
		Where("external_source = ?", externalSource).
		Where("external_id = ?", externalID).
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &instrument, nil
}

func (r *InstrumentRepository) GetByGlobalIdentifier(ctx context.Context, field, value string) (*model.Instrument, error) {
	var instruments []model.Instrument
	err := r.db.NewSelect().
		Model(&instruments).
		Where(fmt.Sprintf("%s = ?", field), value).
		Limit(2).
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if len(instruments) != 1 {
		return nil, ErrNotFound
	}
	return &instruments[0], nil
}

// Search performs instrument search across four strategies in order:
// 1. Exact symbol match (B-tree indexed)
// 2. Exact text match (B-tree indexed)
// 3. tsvector full-text search (GIN indexed) — NEW in large-effort tier
// 4. Fuzzy trigram search (pg_trgm) — expensive fallback
// Strategies 1+2 run in parallel. Strategy 3 runs only if results are insufficient.
// Strategy 4 runs only if all prior strategies fail to produce enough results.
func (r *InstrumentRepository) Search(ctx context.Context, query string, filter InstrumentSearchFilter) ([]InstrumentSearchRow, error) {
	symbolQuery := normalizeSymbolSearchQuery(query)
	textQuery := normalizeTextSearchQuery(query)
	if symbolQuery == "" && textQuery == "" {
		return []InstrumentSearchRow{}, nil
	}
	limit := max(filter.Limit, 1)
	offset := max(filter.Offset, 0)

	// Run exact symbol and text searches in parallel (both fast, B-tree indexed)
	type searchResult struct {
		rows []InstrumentSearchRow
		err  error
	}
	exactCh := make(chan searchResult, 1)
	textCh := make(chan searchResult, 1)

	go func() {
		r, e := r.searchExactSymbolInstruments(ctx, symbolQuery, filter, limit+offset)
		exactCh <- searchResult{r, e}
	}()
	go func() {
		r, e := r.searchExactTextInstruments(ctx, textQuery, filter, limit+offset)
		textCh <- searchResult{r, e}
	}()

	exactRes := <-exactCh
	if exactRes.err != nil {
		return nil, exactRes.err
	}
	exactRes.rows = filterVisibleInstrumentSearchRows(exactRes.rows, filter.OwnerUserID)
	scoreInstrumentRows(exactRes.rows, symbolQuery, textQuery)

	textRes := <-textCh
	if textRes.err != nil {
		return nil, textRes.err
	}
	textRes.rows = filterVisibleInstrumentSearchRows(textRes.rows, filter.OwnerUserID)
	scoreInstrumentRows(textRes.rows, symbolQuery, textQuery)

	rows := mergeInstrumentSearchRows(exactRes.rows, textRes.rows)
	topScore := maxScore(rows)

	// Try tsvector full-text search before falling back to expensive pg_trgm fuzzy.
	// tsvector is GIN-indexed and handles partial-word matching (e.g. "appl" → "Apple"),
	// multi-word queries, and weighted ranking (symbol > name > aliases).
	if len(rows) < limit || topScore < 500 {
		tsRows, err := r.searchTsvectorTextInstruments(ctx, textQuery, filter, limit+offset)
		if err != nil {
			return nil, err
		}
		tsRows = filterVisibleInstrumentSearchRows(tsRows, filter.OwnerUserID)
		scoreInstrumentRows(tsRows, symbolQuery, textQuery)
		rows = mergeInstrumentSearchRows(rows, tsRows)
		topScore = maxScore(rows)
	}

	// Only run expensive fuzzy (trigram) search if all prior strategies are insufficient
	if len(rows) < limit || topScore < 700 {
		fuzzyRows, err := r.searchFuzzyInstruments(ctx, symbolQuery, textQuery, filter, limit+offset)
		if err != nil {
			return nil, err
		}
		fuzzyRows = filterVisibleInstrumentSearchRows(fuzzyRows, filter.OwnerUserID)
		scoreInstrumentRows(fuzzyRows, symbolQuery, textQuery)
		rows = mergeInstrumentSearchRows(rows, fuzzyRows)
	}

	sortInstrumentRows(rows)
	rows = sliceInstrumentSearchRows(rows, offset, limit)
	return rows, nil
}

// SearchBaseline mirrors the pre-tsvector Search behavior — exact symbol + exact text
// (in parallel), then fuzzy trigram as fallback. No tsvector step.
//
// BENCHMARK ONLY — keep in sync with Search(). Any changes to Search()'s strategy
// orchestration, scoring thresholds, or merge logic MUST be reflected here.
func (r *InstrumentRepository) SearchBaseline(ctx context.Context, query string, filter InstrumentSearchFilter) ([]InstrumentSearchRow, error) {
	symbolQuery := normalizeSymbolSearchQuery(query)
	textQuery := normalizeTextSearchQuery(query)
	if symbolQuery == "" && textQuery == "" {
		return []InstrumentSearchRow{}, nil
	}
	limit := max(filter.Limit, 1)
	offset := max(filter.Offset, 0)

	type searchResult struct {
		rows []InstrumentSearchRow
		err  error
	}
	exactCh := make(chan searchResult, 1)
	textCh := make(chan searchResult, 1)

	go func() {
		r, e := r.searchExactSymbolInstruments(ctx, symbolQuery, filter, limit+offset)
		exactCh <- searchResult{r, e}
	}()
	go func() {
		r, e := r.searchExactTextInstruments(ctx, textQuery, filter, limit+offset)
		textCh <- searchResult{r, e}
	}()

	exactRes := <-exactCh
	if exactRes.err != nil {
		return nil, exactRes.err
	}
	exactRes.rows = filterVisibleInstrumentSearchRows(exactRes.rows, filter.OwnerUserID)
	scoreInstrumentRows(exactRes.rows, symbolQuery, textQuery)

	textRes := <-textCh
	if textRes.err != nil {
		return nil, textRes.err
	}
	textRes.rows = filterVisibleInstrumentSearchRows(textRes.rows, filter.OwnerUserID)
	scoreInstrumentRows(textRes.rows, symbolQuery, textQuery)

	rows := mergeInstrumentSearchRows(exactRes.rows, textRes.rows)
	topScore := maxScore(rows)

	// Only run expensive fuzzy (trigram) search if exact strategies are insufficient
	if len(rows) < limit || topScore < 700 {
		fuzzyRows, err := r.searchFuzzyInstruments(ctx, symbolQuery, textQuery, filter, limit+offset)
		if err != nil {
			return nil, err
		}
		fuzzyRows = filterVisibleInstrumentSearchRows(fuzzyRows, filter.OwnerUserID)
		scoreInstrumentRows(fuzzyRows, symbolQuery, textQuery)
		rows = mergeInstrumentSearchRows(rows, fuzzyRows)
	}

	sortInstrumentRows(rows)
	rows = sliceInstrumentSearchRows(rows, offset, limit)
	return rows, nil
}

func (r *InstrumentRepository) SearchLocalInstruments(ctx context.Context, query string, filter InstrumentSearchFilter) ([]InstrumentSearchRow, error) {
	return r.Search(ctx, query, filter)
}

func (r *InstrumentRepository) searchExactSymbolInstruments(ctx context.Context, symbolQuery string, filter InstrumentSearchFilter, limit int) ([]InstrumentSearchRow, error) {
	if symbolQuery == "" {
		return []InstrumentSearchRow{}, nil
	}

	var rows []InstrumentSearchRow
	querySQL := r.db.NewSelect().
		Model(&rows).
		ModelTableExpr("sigma_finance.instruments AS i").
		ColumnExpr("i.*").
		ColumnExpr("NULL AS alias_match")

	// Build symbol-matching condition: exact/prefix match on normalized_symbol
	// (and standard identifiers) OR ticker-candidate typo match.
	// Use OR between them (not AND) so that exact prefix match (e.g. "AAPL"
	// matching "AAPL.US" via LIKE 'AAPL%') isn't nullified by the IN clause
	// whose candidates are exactly the same length as the query.
	if candidates := buildTickerCandidates(symbolQuery); len(candidates) > 0 {
		querySQL = querySQL.WhereGroup(" OR ", func(q *bun.SelectQuery) *bun.SelectQuery {
			q = q.Where("(i.normalized_symbol = ? OR i.normalized_symbol LIKE ? OR i.isin = ? OR i.cusip = ? OR i.figi = ?)", symbolQuery, symbolQuery+"%", symbolQuery, symbolQuery, symbolQuery)
			q = q.Where("i.normalized_symbol IN (?)", bun.In(candidates))
			return q
		})
	} else {
		querySQL = querySQL.Where("(i.normalized_symbol = ? OR i.normalized_symbol LIKE ? OR i.isin = ? OR i.cusip = ? OR i.figi = ?)", symbolQuery, symbolQuery+"%", symbolQuery, symbolQuery, symbolQuery)
	}

	if len(filter.AssetTypes) > 0 {
		querySQL = querySQL.Where("i.asset_type IN (?)", bun.In(filter.AssetTypes))
	}
	if filter.Exchange != nil && *filter.Exchange != "" {
		querySQL = querySQL.Where("i.exchange = ?", *filter.Exchange)
	}
	querySQL = querySQL.Where("i.status <> ?", model.InstrumentStatusArchived)
	querySQL = querySQL.OrderExpr("i.normalized_symbol ASC").Limit(limit)

	if err := querySQL.Scan(ctx); err != nil {
		return nil, err
	}

	return rows, nil
}

func (r *InstrumentRepository) searchExactTextInstruments(ctx context.Context, textQuery string, filter InstrumentSearchFilter, limit int) ([]InstrumentSearchRow, error) {
	if textQuery == "" {
		return []InstrumentSearchRow{}, nil
	}

	var rows []InstrumentSearchRow
	querySQL := r.db.NewSelect().
		Model(&rows).
		ModelTableExpr("sigma_finance.instruments AS i").
		ColumnExpr("i.*").
		ColumnExpr("(SELECT a.normalized_alias_text FROM sigma_finance.instrument_aliases AS a WHERE a.instrument_id = i.id AND (a.normalized_alias_text = ? OR a.normalized_alias_text LIKE ?) ORDER BY CASE WHEN a.normalized_alias_text = ? THEN 0 ELSE 1 END LIMIT 1) AS alias_match", textQuery, textQuery+"%", textQuery).
		Where("(i.normalized_name = ? OR i.normalized_name LIKE ? OR EXISTS (SELECT 1 FROM sigma_finance.instrument_aliases AS a WHERE a.instrument_id = i.id AND (a.normalized_alias_text = ? OR a.normalized_alias_text LIKE ?)) OR LOWER(COALESCE(i.sector, '')) = ? OR LOWER(COALESCE(i.industry_group, '')) = ? OR LOWER(COALESCE(i.industry, '')) = ? OR LOWER(COALESCE(i.category_group, '')) = ? OR LOWER(COALESCE(i.category, '')) = ? OR LOWER(COALESCE(i.family, '')) = ?)",
			textQuery,
			textQuery+"%",
			textQuery,
			textQuery,
			textQuery,
			textQuery,
			textQuery,
			textQuery,
			textQuery,
			textQuery,
		)

	if len(filter.AssetTypes) > 0 {
		querySQL = querySQL.Where("i.asset_type IN (?)", bun.In(filter.AssetTypes))
	}
	if filter.Exchange != nil && *filter.Exchange != "" {
		querySQL = querySQL.Where("i.exchange = ?", *filter.Exchange)
	}
	querySQL = querySQL.Where("i.status <> ?", model.InstrumentStatusArchived)
	querySQL = querySQL.OrderExpr("i.normalized_symbol ASC").Limit(limit)

	if err := querySQL.Scan(ctx); err != nil {
		return nil, err
	}

	return rows, nil
}

// searchTsvectorTextInstruments uses PostgreSQL full-text search (tsvector) for
// partial-word matching with weighted ranking. The search_vector column is
// auto-populated by a database trigger from normalized_symbol (weight A),
// normalized_name (weight B), and instrument_aliases.normalized_alias_text (weight C).
//
// The query is tokenized into words, each prefixed with :* for prefix matching,
// and joined with | (OR) for broad matching. Results are ranked by ts_rank
// which accounts for the weighted contributions of symbol, name, and aliases.
func (r *InstrumentRepository) searchTsvectorTextInstruments(ctx context.Context, textQuery string, filter InstrumentSearchFilter, limit int) ([]InstrumentSearchRow, error) {
	if textQuery == "" {
		return []InstrumentSearchRow{}, nil
	}

	tsquery := buildTsquery(textQuery)
	if tsquery == "" {
		return []InstrumentSearchRow{}, nil
	}

	var rows []InstrumentSearchRow
	querySQL := r.db.NewSelect().
		Model(&rows).
		ModelTableExpr("sigma_finance.instruments AS i").
		ColumnExpr("i.*").
		ColumnExpr("(SELECT a.normalized_alias_text FROM sigma_finance.instrument_aliases AS a WHERE a.instrument_id = i.id AND to_tsvector('simple', a.normalized_alias_text) @@ to_tsquery('simple', ?) ORDER BY ts_rank(to_tsvector('simple', a.normalized_alias_text), to_tsquery('simple', ?)) DESC LIMIT 1) AS alias_match", tsquery, tsquery).
		Where("i.search_vector @@ to_tsquery('simple', ?)", tsquery)

	if len(filter.AssetTypes) > 0 {
		querySQL = querySQL.Where("i.asset_type IN (?)", bun.In(filter.AssetTypes))
	}
	if filter.Exchange != nil && *filter.Exchange != "" {
		querySQL = querySQL.Where("i.exchange = ?", *filter.Exchange)
	}
	querySQL = querySQL.Where("i.status <> ?", model.InstrumentStatusArchived)
	querySQL = querySQL.OrderExpr("ts_rank(i.search_vector, to_tsquery('simple', ?), 32) DESC, i.normalized_symbol ASC", tsquery).Limit(limit)

	if err := querySQL.Scan(ctx); err != nil {
		return nil, err
	}

	return rows, nil
}

// buildTsquery constructs a PostgreSQL tsquery string from a normalized text query.
// Each word is stripped of non-alphanumeric characters and appended with :* for
// prefix matching (e.g. "appl" matches "apple"). Words are joined with | (OR).
func buildTsquery(textQuery string) string {
	words := strings.Fields(textQuery)
	if len(words) == 0 {
		return ""
	}
	tsqueryWords := make([]string, 0, len(words))
	for _, w := range words {
		// Strip non-alphanumeric characters for safety
		clean := strings.Map(func(r rune) rune {
			if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
				return r
			}
			return -1
		}, w)
		if len(clean) < 2 {
			continue
		}
		tsqueryWords = append(tsqueryWords, clean+":*")
	}
	if len(tsqueryWords) == 0 {
		return ""
	}
	return strings.Join(tsqueryWords, " | ")
}

func (r *InstrumentRepository) searchFuzzyInstruments(ctx context.Context, symbolQuery, textQuery string, filter InstrumentSearchFilter, limit int) ([]InstrumentSearchRow, error) {
	if len(symbolQuery) < 3 && len(textQuery) < 3 {
		return []InstrumentSearchRow{}, nil
	}

	var rows []InstrumentSearchRow
	querySQL := r.db.NewSelect().
		Model(&rows).
		ModelTableExpr("sigma_finance.instruments AS i").
		ColumnExpr("i.*").
		ColumnExpr("(SELECT a.normalized_alias_text FROM sigma_finance.instrument_aliases AS a WHERE a.instrument_id = i.id AND a.normalized_alias_text % ? ORDER BY similarity(a.normalized_alias_text, ?) DESC LIMIT 1) AS alias_match", textQuery, textQuery).
		Where("(i.normalized_symbol % ? OR i.normalized_name % ? OR EXISTS (SELECT 1 FROM sigma_finance.instrument_aliases AS a WHERE a.instrument_id = i.id AND a.normalized_alias_text % ?))", symbolQuery, textQuery, textQuery)

	if len(filter.AssetTypes) > 0 {
		querySQL = querySQL.Where("i.asset_type IN (?)", bun.In(filter.AssetTypes))
	}
	if filter.Exchange != nil && *filter.Exchange != "" {
		querySQL = querySQL.Where("i.exchange = ?", *filter.Exchange)
	}
	querySQL = querySQL.Where("i.status <> ?", model.InstrumentStatusArchived)
	querySQL = querySQL.OrderExpr("GREATEST(similarity(i.normalized_symbol, ?), similarity(i.normalized_name, ?)) DESC, i.normalized_symbol ASC", symbolQuery, textQuery).Limit(limit)

	if err := querySQL.Scan(ctx); err != nil {
		return nil, err
	}

	return rows, nil
}

func (r *InstrumentRepository) ListManual(ctx context.Context, filter ManualInstrumentFilter) ([]model.Instrument, error) {
	limit := max(filter.Limit, 1)
	offset := max(filter.Offset, 0)

	var instruments []model.Instrument
	query := r.db.NewSelect().
		Model(&instruments).
		ModelTableExpr("sigma_finance.instruments AS instrument").
		Where("provider_source = ?", "manual")
	if filter.OwnerUserID != nil {
		query = query.Where("owner_user_id = ?", *filter.OwnerUserID)
	} else {
		query = query.Where("1 = 0")
	}
	if !filter.IncludeArchived {
		query = query.Where("status <> ?", model.InstrumentStatusArchived)
	}
	if len(filter.AssetTypes) > 0 {
		query = query.Where("asset_type IN (?)", bun.In(filter.AssetTypes))
	}

	normalizedQuery := normalizeTextSearchQuery(filter.Query)
	if normalizedQuery != "" {
		like := "%" + normalizedQuery + "%"
		query = query.WhereGroup(" AND ", func(q *bun.SelectQuery) *bun.SelectQuery {
			return q.Where(
				"(instrument.normalized_symbol ILIKE ? OR instrument.normalized_name ILIKE ? OR EXISTS (SELECT 1 FROM sigma_finance.instrument_aliases a WHERE a.instrument_id = instrument.id AND a.normalized_alias_text ILIKE ?))",
				like,
				like,
				like,
			)
		})
		query = query.OrderExpr(
			"CASE WHEN instrument.normalized_symbol = ? THEN 0 WHEN instrument.normalized_symbol ILIKE ? THEN 1 WHEN instrument.normalized_name = ? THEN 2 WHEN instrument.normalized_name ILIKE ? THEN 3 ELSE 4 END, instrument.updated_at DESC, instrument.normalized_symbol ASC",
			strings.ToUpper(strings.TrimSpace(filter.Query)),
			strings.ToUpper(strings.TrimSpace(filter.Query))+"%",
			normalizedQuery,
			like,
		)
	} else {
		query = query.OrderExpr("instrument.updated_at DESC, instrument.normalized_symbol ASC")
	}

	query = query.Limit(limit + 1).Offset(offset)
	if err := query.Scan(ctx); err != nil {
		return nil, err
	}

	return instruments, nil
}

func filterVisibleInstrumentSearchRows(rows []InstrumentSearchRow, ownerUserID *string) []InstrumentSearchRow {
	if ownerUserID == nil {
		filtered := make([]InstrumentSearchRow, 0, len(rows))
		for _, row := range rows {
			if !strings.EqualFold(row.Instrument.ProviderSource, "manual") {
				filtered = append(filtered, row)
			}
		}
		return filtered
	}

	filtered := make([]InstrumentSearchRow, 0, len(rows))
	for _, row := range rows {
		if !strings.EqualFold(row.Instrument.ProviderSource, "manual") {
			filtered = append(filtered, row)
			continue
		}
		if row.Instrument.OwnerUserID != nil && *row.Instrument.OwnerUserID == *ownerUserID {
			filtered = append(filtered, row)
		}
	}
	return filtered
}

func (r *InstrumentRepository) Upsert(ctx context.Context, instrument *model.Instrument) (*model.Instrument, error) {
	now := time.Now()
	if instrument.CreatedAt.IsZero() {
		instrument.CreatedAt = now
	}
	instrument.UpdatedAt = now

	existing, err := r.GetBySymbolAndExchange(ctx, instrument.NormalizedSymbol, instrument.Exchange, instrument.AssetType)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return nil, err
	}

	if existing != nil {
		instrument.ID = existing.ID
		instrument.CreatedAt = existing.CreatedAt
		_, err = r.db.NewUpdate().
			Model(instrument).
			WherePK().
			Returning("*").
			Exec(ctx)
		if err != nil {
			return nil, err
		}
		return instrument, nil
	}

	_, err = r.db.NewInsert().
		Model(instrument).
		Returning("*").
		Exec(ctx)
	if err != nil {
		return nil, err
	}
	return instrument, nil
}

func (r *InstrumentRepository) UpsertCatalogInstrument(ctx context.Context, instrument *model.Instrument) (*model.Instrument, error) {
	if instrument.ExternalSource == nil || strings.TrimSpace(*instrument.ExternalSource) == "" ||
		instrument.ExternalID == nil || strings.TrimSpace(*instrument.ExternalID) == "" {
		return r.Upsert(ctx, instrument)
	}

	now := time.Now()
	if instrument.CreatedAt.IsZero() {
		instrument.CreatedAt = now
	}
	instrument.UpdatedAt = now

	_, err := r.db.NewInsert().
		Model(instrument).
		ModelTableExpr("sigma_finance.instruments AS instruments").
		On("CONFLICT (external_source, external_id) WHERE external_source IS NOT NULL AND external_id IS NOT NULL DO UPDATE").
		Set("symbol = EXCLUDED.symbol").
		Set("normalized_symbol = EXCLUDED.normalized_symbol").
		Set("name = EXCLUDED.name").
		Set("normalized_name = EXCLUDED.normalized_name").
		Set("exchange = EXCLUDED.exchange").
		Set("exchange_code = COALESCE(EXCLUDED.exchange_code, instruments.exchange_code)").
		Set("country = COALESCE(EXCLUDED.country, instruments.country)").
		Set("currency = COALESCE(EXCLUDED.currency, instruments.currency)").
		Set("asset_type = EXCLUDED.asset_type").
		Set("status = EXCLUDED.status").
		Set("provider_source = COALESCE(NULLIF(EXCLUDED.provider_source, ''), instruments.provider_source)").
		Set("provider_external_id = COALESCE(EXCLUDED.provider_external_id, instruments.provider_external_id)").
		Set("external_source = EXCLUDED.external_source").
		Set("external_id = EXCLUDED.external_id").
		Set("platforms_json = COALESCE(EXCLUDED.platforms_json, instruments.platforms_json)").
		Set("primary_contract_address = COALESCE(NULLIF(EXCLUDED.primary_contract_address, ''), instruments.primary_contract_address)").
		Set("instrument_status = COALESCE(NULLIF(EXCLUDED.instrument_status, ''), instruments.instrument_status)").
		Set("market_cap_rank = COALESCE(EXCLUDED.market_cap_rank, instruments.market_cap_rank)").
		Set("image_url = COALESCE(NULLIF(EXCLUDED.image_url, ''), instruments.image_url)").
		Set("metadata_updated_at = COALESCE(EXCLUDED.metadata_updated_at, instruments.metadata_updated_at)").
		Set("metadata = COALESCE(EXCLUDED.metadata, instruments.metadata)").
		Set("last_verified_at = COALESCE(EXCLUDED.last_verified_at, instruments.last_verified_at)").
		Set("updated_at = EXCLUDED.updated_at").
		Returning("*").
		Exec(ctx)
	if err != nil {
		return nil, err
	}
	return instrument, nil
}

func normalizeSearchQuery(value string) string {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	trimmed = strings.Join(strings.Fields(trimmed), " ")
	return trimmed
}

func normalizeSymbolSearchQuery(value string) string {
	trimmed := strings.TrimSpace(strings.ToUpper(value))
	trimmed = strings.Join(strings.Fields(trimmed), " ")
	return trimmed
}

func normalizeTextSearchQuery(value string) string {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	trimmed = strings.Join(strings.Fields(trimmed), " ")
	return trimmed
}

func scoreInstrumentMatch(symbolQuery, textQuery string, instrument model.Instrument, alias *string) float64 {
	score := 0.0
	switch {
	case instrument.NormalizedSymbol == symbolQuery:
		score += 1000
	case instrument.ISIN != nil && strings.EqualFold(*instrument.ISIN, symbolQuery):
		score += 1000
	case instrument.CUSIP != nil && strings.EqualFold(*instrument.CUSIP, symbolQuery):
		score += 1000
	case instrument.FIGI != nil && strings.EqualFold(*instrument.FIGI, symbolQuery):
		score += 1000
	case isNearSymbolMatch(symbolQuery, instrument.NormalizedSymbol):
		score += 925
	case instrument.NormalizedName == textQuery:
		score += 900
	case strings.HasPrefix(instrument.NormalizedSymbol, symbolQuery):
		score += 800
	case strings.HasPrefix(instrument.NormalizedName, textQuery):
		score += 700
	case alias != nil && *alias == textQuery:
		score += 600
	default:
		score += 500
	}

	score += similarityScore(textQuery, instrument.NormalizedName) * 100
	score += similarityScore(symbolQuery, instrument.NormalizedSymbol) * 120
	if alias != nil {
		score += similarityScore(textQuery, *alias) * 100
	}

	// Multi-word query boost: rewards instruments whose name contains multiple query words.
	// E.g. "apple tech" boosts "Apple Inc." (matches "apple") even if "tech" doesn't match exactly.
	if textQuery != "" {
		score += multiWordMatchBoost(textQuery, instrument.NormalizedName)
		if alias != nil {
			score += multiWordMatchBoost(textQuery, *alias) * 0.5
		}
	}

	// Market-cap rank boost: popular/large-cap instruments surface higher.
	// Lower rank number = more popular (rank 1 = Bitcoin, rank 2 = Ethereum, etc.)
	if instrument.MarketCapRank != nil {
		score += marketCapRankBoost(*instrument.MarketCapRank)
	} else {
		score += 5 // neutral for unranked instruments
	}

	switch instrument.Status {
	case model.InstrumentStatusActive:
		score += 50
	case model.InstrumentStatusStale:
		score += 20
	case model.InstrumentStatusDelisted:
		score += 0
	default:
		score += 10
	}

	if instrument.LastUsedAt != nil {
		ageHours := time.Since(*instrument.LastUsedAt).Hours()
		score += math.Max(0, 25-math.Min(25, ageHours/24))
	}

	return score
}

// multiWordMatchBoost rewards instruments whose normalized name contains
// multiple words from a multi-word query tokenized by whitespace.
// Returns up to 150 points, scaled by the proportion of query words matched.
func multiWordMatchBoost(query, name string) float64 {
	queryWords := strings.Fields(query)
	if len(queryWords) <= 1 || name == "" {
		return 0
	}
	nameWords := strings.Fields(name)
	if len(nameWords) == 0 {
		return 0
	}

	matchCount := 0
	for _, qw := range queryWords {
		if len(qw) < 2 {
			continue // skip single-char noise words
		}
		for _, nw := range nameWords {
			if strings.HasPrefix(nw, qw) {
				matchCount++
				break
			}
		}
	}

	if matchCount == 0 {
		return 0
	}
	return (float64(matchCount) / float64(len(queryWords))) * 150
}

// marketCapRankBoost returns a score boost based on market-cap rank.
// Lower rank = more popular/valuable (rank 1 = largest by market cap).
func marketCapRankBoost(rank int) float64 {
	switch {
	case rank <= 10:
		return 80
	case rank <= 100:
		return 40
	case rank <= 1000:
		return 15
	default:
		return 5
	}
}

func similarityScore(a, b string) float64 {
	if a == "" || b == "" {
		return 0
	}
	distance := levenshtein.ComputeDistance(a, b)
	maxLen := math.Max(float64(len(a)), float64(len(b)))
	if maxLen == 0 {
		return 1
	}
	similarity := 1 - float64(distance)/maxLen
	if similarity < 0 {
		return 0
	}
	return similarity
}

func isTickerLikeQuery(value string) bool {
	if value == "" || strings.ContainsAny(value, " \t\n\r") {
		return false
	}
	if len(value) > 8 {
		return false
	}

	hasAlphaNum := false
	for _, r := range value {
		switch {
		case r >= 'a' && r <= 'z':
			hasAlphaNum = true
		case r >= 'A' && r <= 'Z':
			hasAlphaNum = true
		case r >= '0' && r <= '9':
			hasAlphaNum = true
		case r == '.' || r == '-' || r == '_':
		default:
			return false
		}
	}
	return hasAlphaNum
}

func buildTickerCandidates(query string) []string {
	if !isTickerLikeQuery(query) {
		return nil
	}

	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	seen := map[string]struct{}{
		query: {},
	}

	runes := []rune(query)
	for i, r := range runes {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9') {
			continue
		}
		for _, replacement := range alphabet {
			if replacement == r {
				continue
			}
			candidate := make([]rune, len(runes))
			copy(candidate, runes)
			candidate[i] = replacement
			seen[strings.ToUpper(string(candidate))] = struct{}{}
		}
	}

	candidates := make([]string, 0, len(seen))
	for candidate := range seen {
		candidates = append(candidates, strings.ToUpper(candidate))
	}
	sort.Strings(candidates)

	// Cap to prevent massive IN clauses that force SeqScan,
	// but always keep the original query first so exact symbol
	// searches (e.g. "AAPL") aren't lost to random map iteration.
	const maxTickerCandidates = 12
	if len(candidates) > maxTickerCandidates {
		original := strings.ToUpper(query)
		kept := []string{original}
		for _, c := range candidates {
			if c != original {
				kept = append(kept, c)
			}
			if len(kept) >= maxTickerCandidates {
				break
			}
		}
		candidates = kept
	}
	return candidates
}

func mergeInstrumentSearchRows(base []InstrumentSearchRow, extra []InstrumentSearchRow) []InstrumentSearchRow {
	merged := make(map[string]InstrumentSearchRow, len(base)+len(extra))
	for _, row := range base {
		merged[row.Instrument.ID] = row
	}
	for _, row := range extra {
		existing, ok := merged[row.Instrument.ID]
		if !ok || row.Score > existing.Score {
			merged[row.Instrument.ID] = row
		}
	}

	results := make([]InstrumentSearchRow, 0, len(merged))
	for _, row := range merged {
		results = append(results, row)
	}
	return results
}

func maxScore(rows []InstrumentSearchRow) float64 {
	top := 0.0
	for _, row := range rows {
		if row.Score > top {
			top = row.Score
		}
	}
	return top
}

func scoreInstrumentRows(rows []InstrumentSearchRow, symbolQuery, textQuery string) {
	for i := range rows {
		rows[i].Score = scoreInstrumentMatch(symbolQuery, textQuery, rows[i].Instrument, rows[i].AliasMatch)
	}
}

func sliceInstrumentSearchRows(rows []InstrumentSearchRow, offset, limit int) []InstrumentSearchRow {
	if len(rows) == 0 {
		return rows
	}
	if offset >= len(rows) {
		return []InstrumentSearchRow{}
	}
	end := offset + limit
	if end > len(rows) {
		end = len(rows)
	}
	return rows[offset:end]
}

func isNearSymbolMatch(query, symbol string) bool {
	if query == "" || symbol == "" {
		return false
	}
	if query == symbol {
		return true
	}
	if len(query) > 8 || len(symbol) > 8 {
		return false
	}
	if absInt(len(query)-len(symbol)) > 1 {
		return false
	}
	return levenshtein.ComputeDistance(query, symbol) <= 1
}

func absInt(value int) int {
	if value < 0 {
		return -value
	}
	return value
}

func sortInstrumentRows(rows []InstrumentSearchRow) {
	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].Score == rows[j].Score {
			// Prefer recently used instruments when scores tie
			iUsed := rows[i].Instrument.LastUsedAt
			jUsed := rows[j].Instrument.LastUsedAt
			if iUsed != nil && jUsed != nil && !iUsed.Equal(*jUsed) {
				return iUsed.After(*jUsed)
			}
			// One has usage history, the other doesn't
			if iUsed != nil && jUsed == nil {
				return true
			}
			if iUsed == nil && jUsed != nil {
				return false
			}
			if rows[i].Instrument.Status != rows[j].Instrument.Status {
				return rows[i].Instrument.Status < rows[j].Instrument.Status
			}
			return rows[i].Instrument.NormalizedSymbol < rows[j].Instrument.NormalizedSymbol
		}
		return rows[i].Score > rows[j].Score
	})
}
