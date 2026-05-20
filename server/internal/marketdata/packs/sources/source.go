package sources

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/shopspring/decimal"
)

type CandleSource interface {
	FetchCandles(ctx context.Context, req FetchCandlesRequest) (<-chan NormalizedCandle, <-chan error)
}

// SymbolRanker is optionally implemented by a CandleSource to sort symbols
// by real-time popularity (e.g. 24h trading volume) before fetching.
type SymbolRanker interface {
	RankSymbols(ctx context.Context, symbols []UniverseSymbol) ([]UniverseSymbol, error)
}

// UniverseDiscoverer is optionally implemented by a CandleSource to
// dynamically discover the top N symbols by real-time trading volume,
// replacing static universe YAML files.
type UniverseDiscoverer interface {
	DiscoverUniverse(ctx context.Context, count int) (*Universe, error)
}

type PackSpec struct {
	PackID         string
	Name           string
	Version        string
	Distribution   string
	AssetType      string
	Interval       string
	QuoteCurrency  string
	SourceProvider string
	HistoryStart   string
	HistoryEnd     string
}

type RateLimitConfig struct {
	RequestsPerSecond  int
	Concurrency        int
	RequestsPerMinute  int
	RequestsPerDay     int
	ConcurrentRequests int
}

type FetchCandlesRequest struct {
	PackSpec  PackSpec
	Symbols   []UniverseSymbol
	StartDate time.Time
	EndDate   time.Time
	WorkDir   string
	RateLimit RateLimitConfig
}

type NormalizedCandle struct {
	InstrumentID   string
	Symbol         string
	AssetType      string
	Interval       string
	Timestamp      time.Time
	Open           decimal.Decimal
	High           decimal.Decimal
	Low            decimal.Decimal
	Close          decimal.Decimal
	AdjustedClose  *decimal.Decimal
	Volume         decimal.Decimal
	QuoteCurrency  string
	Source         string
	DerivationType string
	DerivedFrom    []string
}

func CanonicalKey(c NormalizedCandle) string {
	return fmt.Sprintf("%s|%s|%d|%s", strings.TrimSpace(c.InstrumentID), strings.TrimSpace(c.Interval), c.Timestamp.UTC().Unix(), strings.ToUpper(strings.TrimSpace(c.QuoteCurrency)))
}
