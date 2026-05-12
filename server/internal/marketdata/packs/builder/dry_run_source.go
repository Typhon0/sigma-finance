package builder

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"sigma_finance/internal/marketdata/packs/sources"
)

type DryRunSourceOptions struct {
	AllSymbols    bool
	SourceBaseURL string
	WorkDir       string
	RateLimit     sources.RateLimitConfig
}

type DryRunSourceSymbolSummary struct {
	Symbol string
	Rows   int
	First  time.Time
	Last   time.Time
}

type DryRunSourceSummary struct {
	RowsCount int
	Symbols   []DryRunSourceSymbolSummary
}

func RunSourceDryRun(ctx context.Context, plan *BuildPlan, opts DryRunSourceOptions) (*DryRunSourceSummary, error) {
	if plan == nil || plan.Spec == nil || plan.Universe == nil {
		return nil, fmt.Errorf("build plan is required")
	}
	if len(plan.Universe.Symbols) == 0 {
		return nil, fmt.Errorf("universe symbols are required")
	}

	startDate, endDate, err := resolveHistoryRange(plan.Spec.History)
	if err != nil {
		return nil, err
	}

	symbols := plan.Universe.Symbols
	if !opts.AllSymbols && len(symbols) > 2 {
		symbols = symbols[:2]
	}

	source, err := newSourceForProvider(plan.Spec.SourceProvider, opts.SourceBaseURL)
	if err != nil {
		return nil, err
	}
	candlesCh, errCh := source.FetchCandles(ctx, sources.FetchCandlesRequest{
		PackSpec:  toSourcePackSpec(plan.Spec),
		Symbols:   symbols,
		StartDate: startDate,
		EndDate:   endDate,
		WorkDir:   strings.TrimSpace(opts.WorkDir),
		RateLimit: opts.RateLimit,
	})

	stats := make(map[string]DryRunSourceSymbolSummary, len(symbols))
	totalRows := 0
	for candlesCh != nil || errCh != nil {
		select {
		case candle, ok := <-candlesCh:
			if !ok {
				candlesCh = nil
				continue
			}
			totalRows++
			summary := stats[candle.Symbol]
			summary.Symbol = candle.Symbol
			summary.Rows++
			if summary.First.IsZero() || candle.Timestamp.Before(summary.First) {
				summary.First = candle.Timestamp
			}
			if summary.Last.IsZero() || candle.Timestamp.After(summary.Last) {
				summary.Last = candle.Timestamp
			}
			stats[candle.Symbol] = summary
		case err, ok := <-errCh:
			if !ok {
				errCh = nil
				continue
			}
			if err != nil {
				return nil, err
			}
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	symbolSummaries := make([]DryRunSourceSymbolSummary, 0, len(stats))
	for _, summary := range stats {
		symbolSummaries = append(symbolSummaries, summary)
	}
	sort.Slice(symbolSummaries, func(i, j int) bool {
		return symbolSummaries[i].Symbol < symbolSummaries[j].Symbol
	})

	return &DryRunSourceSummary{
		RowsCount: totalRows,
		Symbols:   symbolSummaries,
	}, nil
}

func resolveHistoryRange(history HistorySpec) (time.Time, time.Time, error) {
	start, err := parseDate(history.Start)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid history.start: %w", err)
	}
	endRaw := strings.TrimSpace(history.End)
	var end time.Time
	if strings.EqualFold(endRaw, "auto") || endRaw == "" {
		now := time.Now().UTC()
		end = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	} else {
		end, err = parseDate(endRaw)
		if err != nil {
			return time.Time{}, time.Time{}, fmt.Errorf("invalid history.end: %w", err)
		}
	}
	if end.Before(start) {
		return time.Time{}, time.Time{}, fmt.Errorf("history.end must be on or after history.start")
	}
	return start, end, nil
}

func parseDate(raw string) (time.Time, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return time.Time{}, fmt.Errorf("date is required")
	}
	ts, err := time.Parse("2006-01-02", value)
	if err != nil {
		return time.Time{}, err
	}
	return ts.UTC(), nil
}

func toSourcePackSpec(spec *PackSpec) sources.PackSpec {
	return sources.PackSpec{
		PackID:         strings.TrimSpace(spec.PackID),
		Name:           strings.TrimSpace(spec.Name),
		Version:        strings.TrimSpace(spec.Version),
		Distribution:   strings.TrimSpace(spec.Distribution),
		AssetType:      strings.TrimSpace(spec.AssetType),
		Interval:       strings.TrimSpace(spec.Interval),
		QuoteCurrency:  strings.TrimSpace(spec.QuoteCurrency),
		SourceProvider: strings.TrimSpace(spec.SourceProvider),
		HistoryStart:   strings.TrimSpace(spec.History.Start),
		HistoryEnd:     strings.TrimSpace(spec.History.End),
	}
}
