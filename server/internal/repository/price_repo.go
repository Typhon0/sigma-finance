package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

// TimeRange represents a time range for price queries
type TimeRange struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// PriceFilter defines filter criteria for price queries
type PriceFilter struct {
	AssetID   *uuid.UUID  `json:"asset_id,omitempty"`
	AssetIDs  []uuid.UUID `json:"asset_ids,omitempty"`
	Source    *string     `json:"source,omitempty"`
	TimeRange *TimeRange  `json:"time_range,omitempty"`
	Limit     *int        `json:"limit,omitempty"`
	Offset    *int        `json:"offset,omitempty"`
}

// PriceAggregation represents aggregated price data
type PriceAggregation struct {
	AssetID    uuid.UUID       `json:"asset_id"`
	Open       decimal.Decimal `json:"open"`
	High       decimal.Decimal `json:"high"`
	Low        decimal.Decimal `json:"low"`
	Close      decimal.Decimal `json:"close"`
	Volume     *int64          `json:"volume,omitempty"`
	MarketCap  *int64          `json:"market_cap,omitempty"`
	StartTime  time.Time       `json:"start_time"`
	EndTime    time.Time       `json:"end_time"`
	DataPoints int             `json:"data_points"`
}

// PriceStatistics represents statistical data for price analysis
type PriceStatistics struct {
	AssetID       uuid.UUID        `json:"asset_id"`
	CurrentPrice  decimal.Decimal  `json:"current_price"`
	PreviousPrice decimal.Decimal  `json:"previous_price"`
	Change        decimal.Decimal  `json:"change"`
	ChangePercent decimal.Decimal  `json:"change_percent"`
	DayHigh       decimal.Decimal  `json:"day_high"`
	DayLow        decimal.Decimal  `json:"day_low"`
	WeekHigh      decimal.Decimal  `json:"week_high"`
	WeekLow       decimal.Decimal  `json:"week_low"`
	MonthHigh     decimal.Decimal  `json:"month_high"`
	MonthLow      decimal.Decimal  `json:"month_low"`
	YearHigh      decimal.Decimal  `json:"year_high"`
	YearLow       decimal.Decimal  `json:"year_low"`
	AverageVolume *decimal.Decimal `json:"average_volume,omitempty"`
	LastUpdated   time.Time        `json:"last_updated"`
}

// IPriceRepository defines the interface for price repository operations
type IPriceRepository interface {
	IRepository[model.AssetPrice]

	// Enhanced CRUD operations
	GetLatestPrice(ctx context.Context, assetID uuid.UUID) (*model.AssetPrice, error)
	GetLatestPrices(ctx context.Context, assetIDs []uuid.UUID) ([]model.AssetPrice, error)
	GetPriceHistory(ctx context.Context, assetID uuid.UUID, timeRange TimeRange) ([]model.AssetPrice, error)
	FindWithFilters(ctx context.Context, filter PriceFilter) ([]model.AssetPrice, error)

	// Time-series optimized queries
	GetPricesByTimeRange(ctx context.Context, assetIDs []uuid.UUID, timeRange TimeRange) ([]model.AssetPrice, error)
	GetOHLCData(ctx context.Context, assetID uuid.UUID, timeRange TimeRange, interval string) ([]PriceAggregation, error)
	GetPriceStatistics(ctx context.Context, assetID uuid.UUID) (*PriceStatistics, error)

	// Performance and analytics
	GetStaleAssets(ctx context.Context, maxAge time.Duration) ([]uuid.UUID, error)
	GetAssetsRequiringUpdate(ctx context.Context, sources []string) ([]uuid.UUID, error)
	GetPriceChanges(ctx context.Context, assetIDs []uuid.UUID, timeRange TimeRange) (map[uuid.UUID]decimal.Decimal, error)

	// Batch operations
	UpsertPrices(ctx context.Context, prices []model.AssetPrice) error
	DeleteOldPrices(ctx context.Context, assetID uuid.UUID, olderThan time.Time) error

	// Chart data optimization
	GetSampledPriceData(ctx context.Context, assetID uuid.UUID, timeRange TimeRange, maxPoints int) ([]model.AssetPrice, error)
	GetVolumeWeightedAveragePrice(ctx context.Context, assetID uuid.UUID, timeRange TimeRange) (*decimal.Decimal, error)
}

// PriceRepository is the concrete implementation of IPriceRepository
type PriceRepository struct {
	*Repository[model.AssetPrice]
}

// NewPriceRepository creates a new PriceRepository
func NewPriceRepository(db bun.IDB) *PriceRepository {
	return &PriceRepository{
		Repository: NewRepository[model.AssetPrice](db),
	}
}

// GetLatestPrice retrieves the most recent price for an asset
func (r *PriceRepository) GetLatestPrice(ctx context.Context, assetID uuid.UUID) (*model.AssetPrice, error) {
	var price model.AssetPrice
	err := r.db.NewSelect().
		Model(&price).
		Where("asset_id = ?", assetID).
		Order("timestamp DESC").
		Limit(1).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return &price, nil
}

// GetLatestPrices retrieves the most recent prices for multiple assets
func (r *PriceRepository) GetLatestPrices(ctx context.Context, assetIDs []uuid.UUID) ([]model.AssetPrice, error) {
	if len(assetIDs) == 0 {
		return []model.AssetPrice{}, nil
	}

	var prices []model.AssetPrice
	err := r.db.NewSelect().
		Model(&prices).
		Where("asset_id IN (?)", bun.In(assetIDs)).
		Where("timestamp = (SELECT MAX(timestamp) FROM sigma_finance.asset_prices ap2 WHERE ap2.asset_id = asset_price.asset_id)").
		Order("asset_id, timestamp DESC").
		Scan(ctx)

	return prices, err
}

// GetPriceHistory retrieves price history for an asset within a time range
func (r *PriceRepository) GetPriceHistory(ctx context.Context, assetID uuid.UUID, timeRange TimeRange) ([]model.AssetPrice, error) {
	var prices []model.AssetPrice
	err := r.db.NewSelect().
		Model(&prices).
		Where("asset_id = ?", assetID).
		Where("timestamp >= ? AND timestamp <= ?", timeRange.Start, timeRange.End).
		Order("timestamp ASC").
		Scan(ctx)

	return prices, err
}

// FindWithFilters retrieves prices with multiple filter criteria
func (r *PriceRepository) FindWithFilters(ctx context.Context, filter PriceFilter) ([]model.AssetPrice, error) {
	query := r.db.NewSelect().Model((*model.AssetPrice)(nil))

	// Apply filters
	query = r.applyPriceFilters(query, filter)

	// Apply ordering - by timestamp DESC for most recent first
	query = query.Order("timestamp DESC")

	// Apply pagination
	if filter.Limit != nil && *filter.Limit > 0 {
		query = query.Limit(*filter.Limit)
	}
	if filter.Offset != nil && *filter.Offset > 0 {
		query = query.Offset(*filter.Offset)
	}

	var prices []model.AssetPrice
	err := query.Scan(ctx, &prices)
	return prices, err
}

// applyPriceFilters applies filter criteria to a query
func (r *PriceRepository) applyPriceFilters(query *bun.SelectQuery, filter PriceFilter) *bun.SelectQuery {
	if filter.AssetID != nil {
		query = query.Where("asset_id = ?", *filter.AssetID)
	}

	if len(filter.AssetIDs) > 0 {
		query = query.Where("asset_id IN (?)", bun.In(filter.AssetIDs))
	}

	if filter.Source != nil {
		query = query.Where("source = ?", *filter.Source)
	}

	if filter.TimeRange != nil {
		query = query.Where("timestamp >= ? AND timestamp <= ?",
			filter.TimeRange.Start, filter.TimeRange.End)
	}

	return query
}

// GetPricesByTimeRange retrieves prices for multiple assets within a time range
func (r *PriceRepository) GetPricesByTimeRange(ctx context.Context, assetIDs []uuid.UUID, timeRange TimeRange) ([]model.AssetPrice, error) {
	return r.FindWithFilters(ctx, PriceFilter{
		AssetIDs:  assetIDs,
		TimeRange: &timeRange,
	})
}

// GetOHLCData retrieves OHLC (Open, High, Low, Close) data for charting
func (r *PriceRepository) GetOHLCData(ctx context.Context, assetID uuid.UUID, timeRange TimeRange, interval string) ([]PriceAggregation, error) {
	var aggregations []struct {
		Open       decimal.Decimal `bun:"open"`
		High       decimal.Decimal `bun:"high"`
		Low        decimal.Decimal `bun:"low"`
		Close      decimal.Decimal `bun:"close"`
		Volume     *int64          `bun:"volume"`
		MarketCap  *int64          `bun:"market_cap"`
		StartTime  time.Time       `bun:"start_time"`
		EndTime    time.Time       `bun:"end_time"`
		DataPoints int             `bun:"data_points"`
	}

	// Determine the time bucket based on interval
	var timeBucket string
	switch interval {
	case "1m":
		timeBucket = "date_trunc('minute', timestamp)"
	case "5m":
		timeBucket = "date_trunc('minute', timestamp - interval '1 minute' * (extract(minute from timestamp)::int % 5))"
	case "15m":
		timeBucket = "date_trunc('minute', timestamp - interval '1 minute' * (extract(minute from timestamp)::int % 15))"
	case "1h":
		timeBucket = "date_trunc('hour', timestamp)"
	case "4h":
		timeBucket = "date_trunc('hour', timestamp - interval '1 hour' * (extract(hour from timestamp)::int % 4))"
	case "1d":
		timeBucket = "date_trunc('day', timestamp)"
	case "1w":
		timeBucket = "date_trunc('week', timestamp)"
	case "1M":
		timeBucket = "date_trunc('month', timestamp)"
	default:
		timeBucket = "date_trunc('hour', timestamp)" // Default to hourly
	}

	err := r.db.NewSelect().
		ColumnExpr("(array_agg(price ORDER BY timestamp ASC))[1] as open").
		ColumnExpr("MAX(price) as high").
		ColumnExpr("MIN(price) as low").
		ColumnExpr("(array_agg(price ORDER BY timestamp DESC))[1] as close").
		ColumnExpr("SUM(volume) as volume").
		ColumnExpr("AVG(market_cap) as market_cap").
		ColumnExpr("MIN(timestamp) as start_time").
		ColumnExpr("MAX(timestamp) as end_time").
		ColumnExpr("COUNT(*) as data_points").
		Model((*model.AssetPrice)(nil)).
		Where("asset_id = ?", assetID).
		Where("timestamp >= ? AND timestamp <= ?", timeRange.Start, timeRange.End).
		GroupExpr(timeBucket).
		OrderExpr("start_time ASC").
		Scan(ctx, &aggregations)
	if err != nil {
		return nil, err
	}

	// Convert to result format
	result := make([]PriceAggregation, len(aggregations))
	for i, agg := range aggregations {
		result[i] = PriceAggregation{
			AssetID:    assetID,
			Open:       agg.Open,
			High:       agg.High,
			Low:        agg.Low,
			Close:      agg.Close,
			Volume:     agg.Volume,
			MarketCap:  agg.MarketCap,
			StartTime:  agg.StartTime,
			EndTime:    agg.EndTime,
			DataPoints: agg.DataPoints,
		}
	}

	return result, nil
}

// GetPriceStatistics calculates price statistics for an asset
func (r *PriceRepository) GetPriceStatistics(ctx context.Context, assetID uuid.UUID) (*PriceStatistics, error) {
	now := time.Now()
	dayAgo := now.AddDate(0, 0, -1)
	weekAgo := now.AddDate(0, 0, -7)
	monthAgo := now.AddDate(0, -1, 0)
	yearAgo := now.AddDate(-1, 0, 0)

	// Get current and previous prices
	var currentPrice, previousPrice decimal.Decimal
	var lastUpdated time.Time

	err := r.db.NewSelect().
		ColumnExpr("price, timestamp").
		Model((*model.AssetPrice)(nil)).
		Where("asset_id = ?", assetID).
		Order("timestamp DESC").
		Limit(1).
		Scan(ctx, &currentPrice, &lastUpdated)
	if err != nil {
		return nil, err
	}

	// Get previous day's price for change calculation
	err = r.db.NewSelect().
		ColumnExpr("price").
		Model((*model.AssetPrice)(nil)).
		Where("asset_id = ?", assetID).
		Where("timestamp <= ?", dayAgo).
		Order("timestamp DESC").
		Limit(1).
		Scan(ctx, &previousPrice)
	if err != nil {
		// If no previous price found, use current price
		previousPrice = currentPrice
	}

	// Get high/low statistics for different periods
	var stats struct {
		DayHigh   decimal.Decimal  `bun:"day_high"`
		DayLow    decimal.Decimal  `bun:"day_low"`
		WeekHigh  decimal.Decimal  `bun:"week_high"`
		WeekLow   decimal.Decimal  `bun:"week_low"`
		MonthHigh decimal.Decimal  `bun:"month_high"`
		MonthLow  decimal.Decimal  `bun:"month_low"`
		YearHigh  decimal.Decimal  `bun:"year_high"`
		YearLow   decimal.Decimal  `bun:"year_low"`
		AvgVolume *decimal.Decimal `bun:"avg_volume"`
	}

	err = r.db.NewSelect().
		ColumnExpr("MAX(CASE WHEN timestamp >= ? THEN price END) as day_high", dayAgo).
		ColumnExpr("MIN(CASE WHEN timestamp >= ? THEN price END) as day_low", dayAgo).
		ColumnExpr("MAX(CASE WHEN timestamp >= ? THEN price END) as week_high", weekAgo).
		ColumnExpr("MIN(CASE WHEN timestamp >= ? THEN price END) as week_low", weekAgo).
		ColumnExpr("MAX(CASE WHEN timestamp >= ? THEN price END) as month_high", monthAgo).
		ColumnExpr("MIN(CASE WHEN timestamp >= ? THEN price END) as month_low", monthAgo).
		ColumnExpr("MAX(CASE WHEN timestamp >= ? THEN price END) as year_high", yearAgo).
		ColumnExpr("MIN(CASE WHEN timestamp >= ? THEN price END) as year_low", yearAgo).
		ColumnExpr("AVG(CASE WHEN timestamp >= ? AND volume IS NOT NULL THEN volume END) as avg_volume", monthAgo).
		Model((*model.AssetPrice)(nil)).
		Where("asset_id = ?", assetID).
		Scan(ctx, &stats)
	if err != nil {
		return nil, err
	}

	// Calculate change and change percentage
	change := currentPrice.Sub(previousPrice)
	var changePercent decimal.Decimal
	if !previousPrice.IsZero() {
		changePercent = change.Div(previousPrice).Mul(decimal.NewFromInt(100))
	}

	return &PriceStatistics{
		AssetID:       assetID,
		CurrentPrice:  currentPrice,
		PreviousPrice: previousPrice,
		Change:        change,
		ChangePercent: changePercent,
		DayHigh:       stats.DayHigh,
		DayLow:        stats.DayLow,
		WeekHigh:      stats.WeekHigh,
		WeekLow:       stats.WeekLow,
		MonthHigh:     stats.MonthHigh,
		MonthLow:      stats.MonthLow,
		YearHigh:      stats.YearHigh,
		YearLow:       stats.YearLow,
		AverageVolume: stats.AvgVolume,
		LastUpdated:   lastUpdated,
	}, nil
}

// GetStaleAssets retrieves assets that haven't been updated within the specified duration
func (r *PriceRepository) GetStaleAssets(ctx context.Context, maxAge time.Duration) ([]uuid.UUID, error) {
	cutoffTime := time.Now().Add(-maxAge)

	var assetIDs []uuid.UUID
	err := r.db.NewSelect().
		ColumnExpr("DISTINCT asset_id").
		Model((*model.AssetPrice)(nil)).
		Where("timestamp < ?", cutoffTime).
		Scan(ctx, &assetIDs)

	return assetIDs, err
}

// GetAssetsRequiringUpdate retrieves assets that need price updates from specific sources
func (r *PriceRepository) GetAssetsRequiringUpdate(ctx context.Context, sources []string) ([]uuid.UUID, error) {
	if len(sources) == 0 {
		return []uuid.UUID{}, nil
	}

	var assetIDs []uuid.UUID
	err := r.db.NewSelect().
		ColumnExpr("DISTINCT a.id").
		Model((*model.Asset)(nil)).
		TableExpr("sigma_finance.assets a").
		Where("a.is_tradeable = true").
		Where("a.market_data_source IN (?)", bun.In(sources)).
		Scan(ctx, &assetIDs)

	return assetIDs, err
}

// GetPriceChanges calculates price changes for multiple assets within a time range
func (r *PriceRepository) GetPriceChanges(ctx context.Context, assetIDs []uuid.UUID, timeRange TimeRange) (map[uuid.UUID]decimal.Decimal, error) {
	if len(assetIDs) == 0 {
		return map[uuid.UUID]decimal.Decimal{}, nil
	}

	var changes []struct {
		AssetID       uuid.UUID       `bun:"asset_id"`
		StartPrice    decimal.Decimal `bun:"start_price"`
		EndPrice      decimal.Decimal `bun:"end_price"`
		ChangePercent decimal.Decimal `bun:"change_percent"`
	}

	err := r.db.NewSelect().
		ColumnExpr("asset_id").
		ColumnExpr("(array_agg(price ORDER BY timestamp ASC))[1] as start_price").
		ColumnExpr("(array_agg(price ORDER BY timestamp DESC))[1] as end_price").
		ColumnExpr("((array_agg(price ORDER BY timestamp DESC))[1] - (array_agg(price ORDER BY timestamp ASC))[1]) / (array_agg(price ORDER BY timestamp ASC))[1] * 100 as change_percent").
		Model((*model.AssetPrice)(nil)).
		Where("asset_id IN (?)", bun.In(assetIDs)).
		Where("timestamp >= ? AND timestamp <= ?", timeRange.Start, timeRange.End).
		Group("asset_id").
		Scan(ctx, &changes)
	if err != nil {
		return nil, err
	}

	// Convert to map
	result := make(map[uuid.UUID]decimal.Decimal)
	for _, change := range changes {
		result[change.AssetID] = change.ChangePercent
	}

	return result, nil
}

// UpsertPrices inserts or updates multiple prices in a single transaction
func (r *PriceRepository) UpsertPrices(ctx context.Context, prices []model.AssetPrice) error {
	if len(prices) == 0 {
		return nil
	}

	_, err := r.db.NewInsert().
		Model(&prices).
		On("CONFLICT (asset_id, timestamp) DO UPDATE").
		Set("price = EXCLUDED.price").
		Set("volume = EXCLUDED.volume").
		Set("market_cap = EXCLUDED.market_cap").
		Set("source = EXCLUDED.source").
		Exec(ctx)

	return err
}

// DeleteOldPrices removes price data older than the specified time
func (r *PriceRepository) DeleteOldPrices(ctx context.Context, assetID uuid.UUID, olderThan time.Time) error {
	_, err := r.db.NewDelete().
		Model((*model.AssetPrice)(nil)).
		Where("asset_id = ? AND timestamp < ?", assetID, olderThan).
		Exec(ctx)

	return err
}

// GetSampledPriceData retrieves sampled price data for chart optimization
func (r *PriceRepository) GetSampledPriceData(ctx context.Context, assetID uuid.UUID, timeRange TimeRange, maxPoints int) ([]model.AssetPrice, error) {
	// Calculate sampling interval based on time range and max points
	duration := timeRange.End.Sub(timeRange.Start)
	intervalSeconds := int(duration.Seconds()) / maxPoints

	if intervalSeconds < 1 {
		intervalSeconds = 1
	}

	var prices []model.AssetPrice
	err := r.db.NewSelect().
		Model(&prices).
		Where("asset_id = ?", assetID).
		Where("timestamp >= ? AND timestamp <= ?", timeRange.Start, timeRange.End).
		Where("extract(epoch from timestamp)::int % ? = 0", intervalSeconds).
		Order("timestamp ASC").
		Limit(maxPoints).
		Scan(ctx)

	return prices, err
}

// GetVolumeWeightedAveragePrice calculates VWAP for an asset within a time range
func (r *PriceRepository) GetVolumeWeightedAveragePrice(ctx context.Context, assetID uuid.UUID, timeRange TimeRange) (*decimal.Decimal, error) {
	var vwap decimal.Decimal
	err := r.db.NewSelect().
		ColumnExpr("SUM(price * COALESCE(volume, 0)) / NULLIF(SUM(COALESCE(volume, 0)), 0)").
		Model((*model.AssetPrice)(nil)).
		Where("asset_id = ?", assetID).
		Where("timestamp >= ? AND timestamp <= ?", timeRange.Start, timeRange.End).
		Where("volume IS NOT NULL AND volume > 0").
		Scan(ctx, &vwap)
	if err != nil {
		return nil, err
	}

	return &vwap, nil
}
