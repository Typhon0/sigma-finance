package model

import (
	"strings"
	"time"

	"github.com/shopspring/decimal"
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
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "1min", "1minute", "1minutes", "1m":
		return "1m"
	case "5min", "5minute", "5minutes", "5m":
		return "5m"
	case "15min", "15minute", "15minutes", "15m":
		return "15m"
	case "30min", "30minute", "30minutes", "30m":
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

// Candle represents an OHLCV bar for an instrument at a specific interval.
// Prices and volume use decimals because small crypto prices cannot be represented
// safely as cents.
type Candle struct {
	bun.BaseModel `bun:"table:sigma_finance.candle"`
	InstrumentID  *string          `bun:"instrument_id,type:uuid"`
	Symbol        string           `bun:"symbol,notnull"`
	AssetType     string           `bun:"asset_type,notnull"` // STOCK | CRYPTO etc.
	Interval      CandleInterval   `bun:"interval,notnull"`
	Open          decimal.Decimal  `bun:"open,type:numeric(38,18),notnull"`
	High          decimal.Decimal  `bun:"high,type:numeric(38,18),notnull"`
	Low           decimal.Decimal  `bun:"low,type:numeric(38,18),notnull"`
	Close         decimal.Decimal  `bun:"close,type:numeric(38,18),notnull"`
	AdjustedClose *decimal.Decimal `bun:"adjusted_close,type:numeric(38,18)"`
	Volume        decimal.Decimal  `bun:"volume,type:numeric(38,8),notnull,default:0"`
	QuoteCurrency string           `bun:"quote_currency,notnull,default:'USD'"`
	Timestamp     time.Time        `bun:"timestamp,notnull"`
	Source        string           `bun:"source,notnull"`
}
