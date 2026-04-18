package model

import (
	"time"

	"github.com/uptrace/bun"
)

// CandleInterval enumerates supported candle granularities.
type CandleInterval string

const (
	Interval1m  CandleInterval = "1m"
	Interval5m  CandleInterval = "5m"
	Interval15m CandleInterval = "15m"
	Interval30m CandleInterval = "30m"
	Interval1h  CandleInterval = "1h"
	Interval4h  CandleInterval = "4h"
	Interval1d  CandleInterval = "1d"
)

func NormalizeInterval(s string) string {
	switch s {
	case "1min", "1minute", "1minutes":
		return "1m"
	case "5min", "5minute", "5minutes":
		return "5m"
	case "15min", "15minute", "15minutes":
		return "15m"
	case "30min", "30minute", "30minutes":
		return "30m"
	case "1hour", "1hr", "1h":
		return "1h"
	case "4hour", "4hr", "4h":
		return "4h"
	case "1day", "1d":
		return "1d"
	default:
		return s
	}
}

// Candle represents an OHLCV bar for a symbol at a specific interval.
// Prices are stored as Money (cents). Volume kept as float64 for now (can change to integer lots later).
type Candle struct {
	bun.BaseModel `bun:"table:sigma_finance.candle"`
	Symbol        string         `bun:"symbol,notnull"`
	AssetType     string         `bun:"asset_type,notnull"` // STOCK | CRYPTO etc.
	Interval      CandleInterval `bun:"interval,notnull"`
	Open          Money          `bun:"open,notnull"`
	High          Money          `bun:"high,notnull"`
	Low           Money          `bun:"low,notnull"`
	Close         Money          `bun:"close,notnull"`
	Volume        float64        `bun:"volume"`
	Timestamp     time.Time      `bun:"timestamp,notnull"`
	Source        string         `bun:"source,notnull"`
}
