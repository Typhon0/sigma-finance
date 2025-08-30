package model

import "time"

// CandleInterval enumerates supported candle granularities.
type CandleInterval string

const (
    Interval1m  CandleInterval = "1m"
    Interval5m  CandleInterval = "5m"
    Interval15m CandleInterval = "15m"
    Interval30m CandleInterval = "30m"
    Interval1h  CandleInterval = "1h"
    Interval4h  CandleInterval = "4h"
    Interval1d  CandleInterval = "1D"
)

// Candle represents an OHLCV bar for a symbol at a specific interval.
// Prices are stored as Money (cents). Volume kept as float64 for now (can change to integer lots later).
type Candle struct {
    Symbol    string         `bun:"symbol,notnull"`
    AssetType string         `bun:"asset_type,notnull"` // STOCK | CRYPTO etc.
    Interval  CandleInterval `bun:"interval,notnull"`
    Open      Money          `bun:"open,notnull"`
    High      Money          `bun:"high,notnull"`
    Low       Money          `bun:"low,notnull"`
    Close     Money          `bun:"close,notnull"`
    Volume    float64        `bun:"volume"`
    Timestamp time.Time      `bun:"timestamp,notnull"`
    Source    string         `bun:"source,notnull"`
}
