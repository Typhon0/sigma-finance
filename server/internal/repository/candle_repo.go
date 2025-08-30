package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/uptrace/bun"
)

// ICandleRepository defines operations for storing and retrieving OHLCV candles.
type ICandleRepository interface {
    BulkUpsert(ctx context.Context, candles []model.Candle) error
    GetRange(ctx context.Context, symbol, assetType string, interval model.CandleInterval, from, to time.Time, limit int) ([]model.Candle, error)
    GetLatest(ctx context.Context, symbol, assetType string, interval model.CandleInterval) (*model.Candle, error)
}

type candleRepository struct { db *bun.DB }

func NewCandleRepository(db *bun.DB) ICandleRepository { return &candleRepository{db: db} }

func (r *candleRepository) BulkUpsert(ctx context.Context, candles []model.Candle) error {
    if len(candles) == 0 { return nil }
    // NOTE: Upsert requires a unique constraint (symbol, asset_type, interval, timestamp)
    _, err := r.db.NewInsert().Model(&candles).On("CONFLICT (symbol, asset_type, interval, timestamp) DO UPDATE").
        Set("open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low, close = EXCLUDED.close, volume = EXCLUDED.volume, source = EXCLUDED.source").
        Exec(ctx)
    return err
}

func (r *candleRepository) GetRange(ctx context.Context, symbol, assetType string, interval model.CandleInterval, from, to time.Time, limit int) ([]model.Candle, error) {
    var out []model.Candle
    q := r.db.NewSelect().Model(&out).
        Where("symbol = ? AND asset_type = ? AND interval = ?", symbol, assetType, interval).
        Where("timestamp >= ? AND timestamp < ?", from, to).
        Order("timestamp ASC").
        Limit(limit)
    err := q.Scan(ctx)
    return out, err
}

func (r *candleRepository) GetLatest(ctx context.Context, symbol, assetType string, interval model.CandleInterval) (*model.Candle, error) {
    var c model.Candle
    err := r.db.NewSelect().Model(&c).
        Where("symbol = ? AND asset_type = ? AND interval = ?", symbol, assetType, interval).
        Order("timestamp DESC").
        Limit(1).Scan(ctx)
    if err != nil { return nil, err }
    return &c, nil
}
