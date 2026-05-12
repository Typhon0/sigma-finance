package store

import (
	"context"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"

	"github.com/shopspring/decimal"
)

type fakeCandleStore struct {
	candles []model.Candle
}

func (f fakeCandleStore) GetRange(context.Context, CandleRangeQuery) ([]model.Candle, error) {
	return append([]model.Candle(nil), f.candles...), nil
}

func (f fakeCandleStore) GetLatest(context.Context, CandleLatestQuery) (*model.Candle, error) {
	return nil, nil
}

func (f fakeCandleStore) GetCoverage(context.Context, CandleCoverageQuery) ([]CandleCoverage, error) {
	return nil, nil
}

type fakeOverlayStore struct {
	fakeCandleStore
}

func (f fakeOverlayStore) BulkUpsert(context.Context, []model.Candle) error {
	return nil
}

func TestHybridCandleStoreDBOverlayWins(t *testing.T) {
	instrumentID := "00000000-0000-0000-0000-000000000001"
	timestamp := time.Date(2019, 1, 1, 0, 0, 0, 0, time.UTC)
	packCandle := candleFixture(instrumentID, timestamp, "PACK", "65000.12345678")
	dbCandle := candleFixture(instrumentID, timestamp, "DB", "65001.12345678")

	hybrid := NewHybridCandleStore(
		fakeCandleStore{candles: []model.Candle{packCandle}},
		fakeOverlayStore{fakeCandleStore{candles: []model.Candle{dbCandle}}},
	)
	candles, err := hybrid.GetRange(context.Background(), CandleRangeQuery{InstrumentID: instrumentID, Interval: model.Interval1d})
	if err != nil {
		t.Fatal(err)
	}
	if len(candles) != 1 {
		t.Fatalf("expected 1 candle, got %d", len(candles))
	}
	if !candles[0].Close.Equal(dbCandle.Close) || candles[0].Source != "DB" {
		t.Fatalf("expected DB candle to win, got source=%s close=%s", candles[0].Source, candles[0].Close)
	}
}

func TestDecimalFromParquetBytesPreservesTinyPrice(t *testing.T) {
	scaled := decimal.RequireFromString("0.000023").Shift(18).BigInt().Bytes()
	got := decimalFromParquetBytes(scaled, 18)
	if !got.Equal(decimal.RequireFromString("0.000023")) {
		t.Fatalf("expected exact tiny price, got %s", got)
	}
}

func candleFixture(instrumentID string, timestamp time.Time, source string, closeValue string) model.Candle {
	return model.Candle{
		InstrumentID:  &instrumentID,
		Symbol:        "BTC",
		AssetType:     "CRYPTO",
		Interval:      model.Interval1d,
		Open:          decimal.RequireFromString(closeValue),
		High:          decimal.RequireFromString(closeValue),
		Low:           decimal.RequireFromString(closeValue),
		Close:         decimal.RequireFromString(closeValue),
		Volume:        decimal.RequireFromString("1.00000000"),
		QuoteCurrency: "USD",
		Timestamp:     timestamp,
		Source:        source,
	}
}
