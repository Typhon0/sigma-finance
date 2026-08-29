package benchmark

import (
	"sort"
	"time"

	"sigma_finance/internal/domain/model"

	"github.com/shopspring/decimal"
)

// =============================================================================
// Sample types (callers convert their domain types to these)
// =============================================================================

// PortfolioSample pairs a portfolio observation's calendar timestamp with
// its total-value in cents (model.Money). Used as the "master" series — the
// resulting aligned output uses portfolio days as the key.
type PortfolioSample struct {
	Timestamp time.Time
	Value     model.Money
}

// BenchmarkSample pairs an instrument price observation's timestamp with
// its price. Forward-filled (LOCF) onto the portfolio's day calendar.
type BenchmarkSample struct {
	Timestamp time.Time
	Price     decimal.Decimal
}

// =============================================================================
// Day-floor + forward-fill alignment
// =============================================================================

// utcDay returns the UTC midnight that owns the given timestamp. Always use
// this (never time.Truncate(24*time.Hour) on a non-UTC time) before keying
// any series for day-aligned pairing; otherwise the off-by-one when DST
// transitions hits will quietly mis-align every result.
//
// This is the single canonical UTC-midnight helper for the package. Both
// the descriptive-stats code and the alignment helper reason in UTC-day
// buckets, so any drift between a "stats.go" version and an "align.go"
// version would silently corrupt a subset of inputs without breaking any
// test that happens to use a non-DST UTC time. Keep it here.
func utcDay(t time.Time) time.Time {
	return t.UTC().Truncate(24 * time.Hour)
}

// AlignDaily joins a portfolio series and a benchmark series into a
// day-aligned pair of (value, price) slices suitable for feeding into
// DailyMoneyReturns + DailyPriceReturns.
//
// Algorithm:
//  1. Floor every input timestamp to UTC midnight (key for day resolution).
//  2. Within each series, collapse multiple samples that share the same UTC
//     day to the latest-by-original-timestamp (last-write-wins).
//  3. Sort each collapsed series ascending by UTC day.
//  4. Walk the portfolio series; for each portfolio day, find the latest
//     benchmark day at-or-before it (LOCF). Portfolio days without any prior
//     benchmark data are dropped.
//
// Returns nil, nil when either input is empty or the resulting alignment has
// fewer than 2 paired points — downstream math requires 2+ pairs to produce
// meaningful sample statistics.
func AlignDaily(portfolio []PortfolioSample, benchmark []BenchmarkSample) ([]model.Money, []decimal.Decimal) {
	if len(portfolio) == 0 || len(benchmark) == 0 {
		return nil, nil
	}

	ports := collapsePortfolioSamples(portfolio)
	benchs := collapseBenchmarkSamples(benchmark)
	if len(ports) == 0 || len(benchs) == 0 {
		return nil, nil
	}

	outPort := make([]model.Money, 0, len(ports))
	outBench := make([]decimal.Decimal, 0, len(ports))

	// Two-pointer walk: j indexes the benchmark's latest covered day; once
	// a portfolio day lands past the current benchmark day we advance j
	// until the next benchmark day is strictly after the portfolio day
	// (or the benchmark runs out).
	var lastBenchPx decimal.Decimal
	j := 0
	for _, p := range ports {
		for j < len(benchs) && !benchs[j].day.After(p.day) {
			lastBenchPx = benchs[j].val
			j++
		}
		if j == 0 {
			// Portfolio observation precedes any benchmark data; LOCF
			// cannot reach back, so drop the observation. This is the
			// correct behavior — fabricating a "the price was 0 last
			// week" estimate would silently bias Beta toward infinity.
			continue
		}
		outPort = append(outPort, p.val)
		outBench = append(outBench, lastBenchPx)
	}

	if len(outPort) < 2 {
		return nil, nil
	}
	return outPort, outBench
}

// =============================================================================
// Collapse helpers (private)
// =============================================================================

// dayMoney and dayPrice are the internal "day-keyed" row types used during
// the last-write-wins pass. The `ts` field holds the original (pre-truncation)
// timestamp so that ties on UTC day resolve to the latest observation.
type dayMoney struct {
	day time.Time
	val model.Money
	ts  time.Time // original timestamp; used to pick the latest-of-day key
}

type dayPrice struct {
	day time.Time
	val decimal.Decimal
	ts  time.Time // original timestamp; used to pick the latest-of-day key
}

// collapsePortfolioSamples folds portfolio observations to last-write-wins
// per UTC day and returns the result sorted ascending by day.
func collapsePortfolioSamples(portfolio []PortfolioSample) []dayMoney {
	rows := make([]dayMoney, 0, len(portfolio))
	for _, p := range portfolio {
		rows = append(rows, dayMoney{
			day: utcDay(p.Timestamp),
			val: p.Value,
			ts:  p.Timestamp,
		})
	}
	sort.SliceStable(rows, func(i, j int) bool {
		if !rows[i].day.Equal(rows[j].day) {
			return rows[i].day.Before(rows[j].day)
		}
		return rows[i].ts.Before(rows[j].ts)
	})
	out := make([]dayMoney, 0, len(rows))
	for _, r := range rows {
		if len(out) > 0 && out[len(out)-1].day.Equal(r.day) {
			// Same UTC day, later timestamp — overwrite with latest.
			out[len(out)-1] = r
			continue
		}
		out = append(out, r)
	}
	return out
}

// collapseBenchmarkSamples is the benchmark-side mirror of
// collapsePortfolioSamples.
func collapseBenchmarkSamples(benchmark []BenchmarkSample) []dayPrice {
	rows := make([]dayPrice, 0, len(benchmark))
	for _, b := range benchmark {
		rows = append(rows, dayPrice{
			day: utcDay(b.Timestamp),
			val: b.Price,
			ts:  b.Timestamp,
		})
	}
	sort.SliceStable(rows, func(i, j int) bool {
		if !rows[i].day.Equal(rows[j].day) {
			return rows[i].day.Before(rows[j].day)
		}
		return rows[i].ts.Before(rows[j].ts)
	})
	out := make([]dayPrice, 0, len(rows))
	for _, r := range rows {
		if len(out) > 0 && out[len(out)-1].day.Equal(r.day) {
			out[len(out)-1] = r
			continue
		}
		out = append(out, r)
	}
	return out
}
