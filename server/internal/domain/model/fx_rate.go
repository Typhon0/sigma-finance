package model

import (
	"time"

	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

// FXRateGranularity represents the time granularity of an FX rate
type FXRateGranularity string

const (
	FXRateGranularityMinute FXRateGranularity = "MINUTE"
	FXRateGranularityHour   FXRateGranularity = "HOUR"
	FXRateGranularityDay    FXRateGranularity = "DAY"
	FXRateGranularityWeek   FXRateGranularity = "WEEK"
	FXRateGranularityMonth  FXRateGranularity = "MONTH"
)

// IsValid checks if the granularity is a supported value
func (g FXRateGranularity) IsValid() bool {
	switch g {
	case FXRateGranularityMinute, FXRateGranularityHour, FXRateGranularityDay,
		FXRateGranularityWeek, FXRateGranularityMonth:
		return true
	default:
		return false
	}
}

// FXRate represents a foreign exchange rate between two currencies
type FXRate struct {
	bun.BaseModel `bun:"table:sigma_finance.fx_rates"`

	ID            string          `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	BaseCurrency  Currency        `bun:"base_currency,notnull"`
	QuoteCurrency Currency        `bun:"quote_currency,notnull"`
	Rate          decimal.Decimal `bun:"rate,type:decimal(20,10),notnull"`
	AsOf          time.Time       `bun:"as_of,notnull"`
	Source        string          `bun:"source,notnull"`
	Granularity   FXRateGranularity `bun:"granularity,notnull"`
	IsStale       bool            `bun:"is_stale,notnull,default:false"`
	CreatedAt     time.Time       `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt     time.Time       `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
}
