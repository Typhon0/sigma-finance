package repository

import (
	"context"
	"log"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/uptrace/bun"
)

// ICandleRepository defines operations for storing and retrieving OHLCV candles.
type ICandleRepository interface {
	BulkUpsert(ctx context.Context, candles []model.Candle) error
	GetRange(ctx context.Context, symbol, assetType string, interval model.CandleInterval, from, to time.Time, limit int) ([]model.Candle, error)
	GetLatest(ctx context.Context, symbol, assetType string, interval model.CandleInterval) (*model.Candle, error)
	GetRangeByInstrument(ctx context.Context, instrumentID string, interval model.CandleInterval, from, to time.Time, quoteCurrency string, limit int) ([]model.Candle, error)
	GetLatestByInstrument(ctx context.Context, instrumentID string, interval model.CandleInterval, quoteCurrency string) (*model.Candle, error)
}

type candleRepository struct{ db *bun.DB }

func NewCandleRepository(db *bun.DB) ICandleRepository { return &candleRepository{db: db} }

func (r *candleRepository) BulkUpsert(ctx context.Context, candles []model.Candle) error {
	if len(candles) == 0 {
		return nil
	}
	withInstrument := make([]model.Candle, 0, len(candles))
	legacy := make([]model.Candle, 0)
	for _, candle := range candles {
		if candle.InstrumentID != nil && *candle.InstrumentID != "" {
			withInstrument = append(withInstrument, candle)
			continue
		}
		legacy = append(legacy, candle)
	}
	if len(withInstrument) > 0 {
		_, err := r.db.NewInsert().Model(&withInstrument).
			On("CONFLICT (instrument_id, interval, timestamp, quote_currency) DO UPDATE").
			Set("symbol = EXCLUDED.symbol").
			Set("asset_type = EXCLUDED.asset_type").
			Set("open = EXCLUDED.open").
			Set("high = EXCLUDED.high").
			Set("low = EXCLUDED.low").
			Set("close = EXCLUDED.close").
			Set("adjusted_close = EXCLUDED.adjusted_close").
			Set("volume = EXCLUDED.volume").
			Exec(ctx)
		if err != nil {
			return err
		}
	}
	if len(legacy) > 0 {
		_, err := r.db.NewInsert().Model(&legacy).
			On("CONFLICT (symbol, asset_type, interval, timestamp) DO UPDATE").
			Set("open = EXCLUDED.open").
			Set("high = EXCLUDED.high").
			Set("low = EXCLUDED.low").
			Set("close = EXCLUDED.close").
			Set("adjusted_close = EXCLUDED.adjusted_close").
			Set("volume = EXCLUDED.volume").
			Set("quote_currency = EXCLUDED.quote_currency").
			Set("source = EXCLUDED.source").
			Exec(ctx)
		return err
	}
	return nil
}

func (r *candleRepository) GetRange(ctx context.Context, symbol, assetType string, interval model.CandleInterval, from, to time.Time, limit int) ([]model.Candle, error) {
	log.Printf("[CandleRepo.GetRange] symbol=%s assetType=%s interval=%s from=%v to=%v limit=%d",
		symbol, assetType, interval, from, to, limit)
	var out []model.Candle
	q := r.db.NewSelect().Model(&out).
		Where("symbol = ? AND asset_type = ? AND interval = ?", symbol, assetType, interval).
		Where("timestamp >= ? AND timestamp < ?", from, to).
		Order("timestamp ASC").
		Limit(limit)
	err := q.Scan(ctx)
	log.Printf("[CandleRepo.GetRange] query returned %d candles, err=%v", len(out), err)
	return out, err
}

func (r *candleRepository) GetLatest(ctx context.Context, symbol, assetType string, interval model.CandleInterval) (*model.Candle, error) {
	var c model.Candle
	err := r.db.NewSelect().Model(&c).
		Where("symbol = ? AND asset_type = ? AND interval = ?", symbol, assetType, interval).
		Order("timestamp DESC").
		Limit(1).Scan(ctx)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *candleRepository) GetRangeByInstrument(ctx context.Context, instrumentID string, interval model.CandleInterval, from, to time.Time, quoteCurrency string, limit int) ([]model.Candle, error) {
	var out []model.Candle
	q := r.db.NewSelect().Model(&out).
		Where("instrument_id = ? AND interval = ?", instrumentID, interval).
		Where("timestamp >= ? AND timestamp < ?", from, to)
	if quoteCurrency != "" {
		q = q.Where("quote_currency = ?", quoteCurrency)
	}
	if limit > 0 {
		q = q.Limit(limit)
	}
	err := q.Order("timestamp ASC").Scan(ctx)
	return out, err
}

func (r *candleRepository) GetLatestByInstrument(ctx context.Context, instrumentID string, interval model.CandleInterval, quoteCurrency string) (*model.Candle, error) {
	var c model.Candle
	q := r.db.NewSelect().Model(&c).
		Where("instrument_id = ? AND interval = ?", instrumentID, interval)
	if quoteCurrency != "" {
		q = q.Where("quote_currency = ?", quoteCurrency)
	}
	err := q.Order("timestamp DESC").Limit(1).Scan(ctx)
	if err != nil {
		return nil, err
	}
	return &c, nil
}
