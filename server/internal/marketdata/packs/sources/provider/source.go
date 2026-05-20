package provider

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/marketdata/packs/sources"
	"sigma_finance/internal/service/providers"
	"strings"
	"sync"
	"time"

	"github.com/shopspring/decimal"
)

const (
	Interval1D = "1d"
)

type Source struct {
	provider   providers.Provider
	providerID string
	apiKey     string
	limiter    *requestLimiter
}

func NewSource(provider providers.Provider, providerID string, apiKey string, rate sources.RateLimitConfig) *Source {
	return &Source{
		provider:   provider,
		providerID: strings.ToUpper(strings.TrimSpace(providerID)),
		apiKey:     strings.TrimSpace(apiKey),
		limiter:    newRequestLimiter(rate),
	}
}

func (s *Source) FetchCandles(ctx context.Context, req sources.FetchCandlesRequest) (<-chan sources.NormalizedCandle, <-chan error) {
	out := make(chan sources.NormalizedCandle)
	errCh := make(chan error, 1)

	go func() {
		defer close(out)
		defer close(errCh)

		if s.provider == nil {
			errCh <- fmt.Errorf("provider is required")
			return
		}
		if len(req.Symbols) == 0 {
			errCh <- fmt.Errorf("symbols are required")
			return
		}
		if req.EndDate.Before(req.StartDate) {
			errCh <- fmt.Errorf("end date must be on or after start date")
			return
		}

		seen := make(map[string]struct{}, len(req.Symbols)*64)
		sourceName := strings.TrimSpace(req.PackSpec.SourceProvider)
		if sourceName == "" {
			sourceName = strings.ToLower(s.providerID)
		}
		for _, symbol := range req.Symbols {
			if err := ctx.Err(); err != nil {
				errCh <- err
				return
			}
			rows, err := s.fetchSymbol(ctx, req, symbol)
			if err != nil {
				errCh <- fmt.Errorf("fetch %s: %w", symbol.Symbol, err)
				return
			}
			for _, row := range rows {
				candle := sources.NormalizedCandle{
					InstrumentID:  strings.TrimSpace(symbol.InstrumentID),
					Symbol:        strings.TrimSpace(symbol.Symbol),
					AssetType:     strings.ToUpper(strings.TrimSpace(symbol.AssetType)),
					Interval:      Interval1D,
					Timestamp:     row.Timestamp.UTC(),
					Open:          row.Open,
					High:          row.High,
					Low:           row.Low,
					Close:         row.Close,
					AdjustedClose: row.AdjustedClose,
					Volume:        row.Volume,
					QuoteCurrency: resolveQuoteCurrency(req.PackSpec.QuoteCurrency, symbol.QuoteAsset),
					Source:        sourceName,
				}
				if err := validateCandle(candle); err != nil {
					errCh <- fmt.Errorf("invalid candle for %s: %w", symbol.Symbol, err)
					return
				}
				key := sources.CanonicalKey(candle)
				if _, exists := seen[key]; exists {
					log.Printf("WARNING: duplicate canonical candle key %s, skipping", key)
					continue
				}
				seen[key] = struct{}{}

				select {
				case <-ctx.Done():
					errCh <- ctx.Err()
					return
				case out <- candle:
				}
			}
		}
	}()

	return out, errCh
}

func (s *Source) fetchSymbol(ctx context.Context, req sources.FetchCandlesRequest, symbol sources.UniverseSymbol) ([]model.Candle, error) {
	request := providers.CandleRequest{
		Symbol:    strings.TrimSpace(symbol.Symbol),
		AssetType: strings.ToUpper(strings.TrimSpace(symbol.AssetType)),
		Interval:  model.Interval1d,
		From:      dayStartUTC(req.StartDate),
		To:        dayStartUTC(req.EndDate).Add(24*time.Hour - time.Microsecond),
		Limit:     10000,
		APIKey:    s.apiKey,
	}
	maxAttempts := 3
	var lastErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		if err := s.limiter.Wait(ctx); err != nil {
			return nil, err
		}
		response, err := s.provider.GetCandles(ctx, request)
		if err == nil {
			if response == nil {
				return []model.Candle{}, nil
			}
			return sortAndFilterRows(response.Candles, request.From, request.To), nil
		}
		lastErr = err
		if !isRetryableProviderError(err) || attempt == maxAttempts {
			return nil, err
		}
		backoff := time.Duration(attempt) * time.Second
		timer := time.NewTimer(backoff)
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil, ctx.Err()
		case <-timer.C:
		}
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("unknown provider error")
	}
	return nil, lastErr
}

func sortAndFilterRows(rows []model.Candle, from time.Time, to time.Time) []model.Candle {
	if len(rows) == 0 {
		return rows
	}
	filtered := make([]model.Candle, 0, len(rows))
	seen := make(map[time.Time]struct{}, len(rows))
	for _, row := range rows {
		ts := dayStartUTC(row.Timestamp)
		if ts.Before(dayStartUTC(from)) || ts.After(dayStartUTC(to)) {
			continue
		}
		if _, ok := seen[ts]; ok {
			continue
		}
		seen[ts] = struct{}{}
		row.Timestamp = ts
		filtered = append(filtered, row)
	}
	for i := 0; i < len(filtered); i++ {
		for j := i + 1; j < len(filtered); j++ {
			if filtered[j].Timestamp.Before(filtered[i].Timestamp) {
				filtered[i], filtered[j] = filtered[j], filtered[i]
			}
		}
	}
	return filtered
}

func resolveQuoteCurrency(specQuote, symbolQuote string) string {
	if value := strings.ToUpper(strings.TrimSpace(specQuote)); value != "" {
		return value
	}
	if value := strings.ToUpper(strings.TrimSpace(symbolQuote)); value != "" {
		return value
	}
	return "USD"
}

func validateCandle(c sources.NormalizedCandle) error {
	if !c.High.GreaterThanOrEqual(c.Low) {
		return fmt.Errorf("high must be >= low")
	}
	if !c.Open.GreaterThan(decimal.Zero) || !c.High.GreaterThan(decimal.Zero) || !c.Low.GreaterThan(decimal.Zero) || !c.Close.GreaterThan(decimal.Zero) {
		return fmt.Errorf("ohlc values must be > 0")
	}
	if c.Timestamp.UTC() != dayStartUTC(c.Timestamp) {
		return fmt.Errorf("timestamp must be UTC day boundary")
	}
	return nil
}

func dayStartUTC(value time.Time) time.Time {
	if value.IsZero() {
		return value
	}
	utc := value.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

func isRetryableProviderError(err error) bool {
	if err == nil {
		return false
	}
	if providers.IsRateLimited(err) {
		return true
	}
	var providerErr *providers.ProviderError
	if errors.As(err, &providerErr) {
		return providerErr.Retryable
	}
	return false
}

type requestLimiter struct {
	mu             sync.Mutex
	interval       time.Duration
	last           time.Time
	dayStart       time.Time
	requestsToday  int
	requestsPerDay int
}

func newRequestLimiter(rate sources.RateLimitConfig) *requestLimiter {
	requestsPerMinute := rate.RequestsPerMinute
	if requestsPerMinute <= 0 && rate.RequestsPerSecond > 0 {
		requestsPerMinute = rate.RequestsPerSecond * 60
	}
	var interval time.Duration
	if requestsPerMinute > 0 {
		interval = time.Minute / time.Duration(requestsPerMinute)
	}
	return &requestLimiter{
		interval:       interval,
		requestsPerDay: rate.RequestsPerDay,
	}
}

func (l *requestLimiter) Wait(ctx context.Context) error {
	l.mu.Lock()
	now := time.Now().UTC()
	day := dayStartUTC(now)
	if l.dayStart.IsZero() || !l.dayStart.Equal(day) {
		l.dayStart = day
		l.requestsToday = 0
	}
	if l.requestsPerDay > 0 && l.requestsToday >= l.requestsPerDay {
		l.mu.Unlock()
		return fmt.Errorf("daily request limit reached")
	}

	wait := time.Duration(0)
	if !l.last.IsZero() && l.interval > 0 {
		next := l.last.Add(l.interval)
		if next.After(now) {
			wait = next.Sub(now)
		}
	}
	l.mu.Unlock()

	if wait > 0 {
		timer := time.NewTimer(wait)
		defer timer.Stop()
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timer.C:
		}
	}

	l.mu.Lock()
	l.last = time.Now().UTC()
	l.requestsToday++
	l.mu.Unlock()
	return nil
}
