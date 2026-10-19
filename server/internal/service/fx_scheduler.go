package service

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service/providers"
)

// FXSchedulerMode defines the refresh cadence mode
type FXSchedulerMode string

const (
	// FXSchedulerModeStandard - refresh every 5 minutes (for idle portfolios)
	FXSchedulerModeStandard FXSchedulerMode = "standard"
	// FXSchedulerModeLive - refresh every 60 seconds (when user actively viewing)
	FXSchedulerModeLive FXSchedulerMode = "live"
	// FXSchedulerModeDaily - refresh once at market close (end-of-day historical record)
	FXSchedulerModeDaily FXSchedulerMode = "daily"

	// Standard interval: 5 minutes
	standardInterval = 5 * time.Minute
	// Live interval: 60 seconds
	liveInterval = 60 * time.Second
	// Market close hour (UTC) for daily refresh - typically 21:00 UTC (4PM EST)
	marketCloseHour   = 21
	marketCloseMinute = 0
)

// Supported FX pairs for the scheduler
var supportedPairs = []model.CurrencyPair{
	{BaseCurrency: model.CurrencyEUR, QuoteCurrency: model.CurrencyUSD},
	{BaseCurrency: model.CurrencyGBP, QuoteCurrency: model.CurrencyUSD},
	{BaseCurrency: model.CurrencyEUR, QuoteCurrency: model.CurrencyGBP},
}

// fxScheduler handles automatic FX rate refreshing
type fxScheduler struct {
	uow           repository.IUnitOfWork
	fxRateService IFXRateService
	provider      providers.Provider
	apiKey        string

	ticker      *time.Ticker
	dailyTicker *time.Ticker
	stopChan    chan struct{}
	running     bool
	mode        FXSchedulerMode
	mutex       sync.Mutex

	// For tracking daily refresh
	lastDailyRefresh time.Time
}

// Global scheduler instance
var fxSchedulerInstance = &fxScheduler{}

// NewFXScheduler creates a new FX scheduler instance
func NewFXScheduler(
	uow repository.IUnitOfWork,
	fxRateService IFXRateService,
	apiKey string,
) *fxScheduler {
	fxSchedulerInstance.uow = uow
	fxSchedulerInstance.fxRateService = fxRateService
	fxSchedulerInstance.provider = providers.NewFXProvider()
	fxSchedulerInstance.apiKey = apiKey
	fxSchedulerInstance.mode = FXSchedulerModeStandard
	return fxSchedulerInstance
}

// Start begins automatic FX rate refreshing in the specified mode
func (s *fxScheduler) Start(mode FXSchedulerMode) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.running {
		return fmt.Errorf("FX scheduler is already running")
	}

	s.mode = mode
	s.stopChan = make(chan struct{})
	s.running = true

	// Start the appropriate ticker based on mode
	interval := s.getIntervalForMode(mode)
	s.ticker = time.NewTicker(interval)

	// Start daily ticker (checks every minute if it's time for daily refresh)
	s.dailyTicker = time.NewTicker(1 * time.Minute)
	s.lastDailyRefresh = s.getLastDailyRefreshTime()

	// Start the refresh loop in a goroutine
	go s.runRefreshLoop()

	// Launch async gap backfill to catch up on any downtime/offline gaps
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		if err := s.backfillDailyGaps(bgCtx); err != nil {
			log.Printf("[WARN] [FXScheduler] Startup daily gap backfill failed: %v", err)
		}
	}()

	log.Printf("[INFO] [FXScheduler] Started in %s mode with interval %v", mode, interval)
	return nil
}

// Stop halts automatic FX rate refreshing
func (s *fxScheduler) Stop() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if !s.running {
		return nil
	}

	s.ticker.Stop()
	s.dailyTicker.Stop()
	close(s.stopChan)
	s.running = false

	log.Printf("[INFO] [FXScheduler] Stopped")
	return nil
}

// SetMode changes the refresh cadence mode while running
func (s *fxScheduler) SetMode(mode FXSchedulerMode) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if !s.running {
		return fmt.Errorf("FX scheduler is not running")
	}

	if s.mode == mode {
		return nil // No change needed
	}

	s.mode = mode
	oldTicker := s.ticker
	interval := s.getIntervalForMode(mode)
	s.ticker = time.NewTicker(interval)
	oldTicker.Stop()

	log.Printf("[INFO] [FXScheduler] Switched to %s mode with interval %v", mode, interval)
	return nil
}

// IsRunning returns whether the scheduler is active
func (s *fxScheduler) IsRunning() bool {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	return s.running
}

// GetMode returns the current scheduler mode
func (s *fxScheduler) GetMode() FXSchedulerMode {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	return s.mode
}

// RefreshNow performs an immediate FX refresh outside the periodic ticker.
func (s *fxScheduler) RefreshNow(ctx context.Context) error {
	if err := s.backfillDailyGaps(ctx); err != nil {
		log.Printf("[WARN] [FXScheduler] Daily gap backfill during RefreshNow: %v", err)
	}
	return s.refresh(ctx)
}

// backfillDailyGaps checks for offline gaps in daily FX rates for supported pairs.
// If the most recent daily rate is older than 24 hours, it requests the missing date range
// in a single batch request from the provider.
func (s *fxScheduler) backfillDailyGaps(ctx context.Context) error {
	now := time.Now().UTC()
	pairs := supportedPairs

	for _, pair := range pairs {
		latestRate, err := s.uow.FXRate().GetLatestRateWithGranularity(ctx, pair.BaseCurrency, pair.QuoteCurrency, model.FXRateGranularityDay)
		var from time.Time
		if err != nil {
			// No daily rate found: default to beginning of current year (or 1 year ago)
			from = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
		} else {
			// If latest rate is less than 24 hours old, no gap to backfill
			if now.Sub(latestRate.AsOf) <= 24*time.Hour {
				continue
			}
			from = latestRate.AsOf.Add(24 * time.Hour)
		}

		if !from.Before(now) {
			continue
		}

		log.Printf("[INFO] [FXScheduler] Backfilling daily gap for %s from %s to %s",
			pair.String(), from.Format("2006-01-02"), now.Format("2006-01-02"))

		req := providers.CandleRequest{
			Symbol:    pair.String(),
			AssetType: "FOREX",
			Interval:  model.Interval1d,
			From:      from,
			To:        now,
			APIKey:    "", // Never use TwelveData for historical backfill
		}

		resp, err := s.provider.GetCandles(ctx, req)
		if err != nil {
			log.Printf("[WARN] [FXScheduler] Failed to backfill daily gap for %s: %v", pair.String(), err)
			continue
		}

		if len(resp.Candles) == 0 {
			continue
		}

		rates := make([]*model.FXRate, 0, len(resp.Candles))
		for _, c := range resp.Candles {
			rates = append(rates, &model.FXRate{
				BaseCurrency:  pair.BaseCurrency,
				QuoteCurrency: pair.QuoteCurrency,
				Rate:          c.Close,
				AsOf:          c.Timestamp.UTC(),
				Source:        c.Source,
				Granularity:   model.FXRateGranularityDay,
				IsStale:       false,
			})
		}

		if err := s.uow.FXRate().SaveRates(ctx, rates); err != nil {
			log.Printf("[ERROR] [FXScheduler] Failed saving backfilled rates for %s: %v", pair.String(), err)
			continue
		}

		log.Printf("[INFO] [FXScheduler] Successfully backfilled %d daily rates for %s", len(rates), pair.String())
	}

	return nil
}

// runRefreshLoop is the main loop that handles tickers
func (s *fxScheduler) runRefreshLoop() {
	for {
		select {
		case <-s.ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
			if err := s.refresh(ctx); err != nil {
				log.Printf("[ERROR] [FXScheduler] Refresh failed: %v", err)
			}
			cancel()

		case <-s.dailyTicker.C:
			if s.shouldPerformDailyRefresh() {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
				if err := s.refreshDaily(ctx); err != nil {
					log.Printf("[ERROR] [FXScheduler] Daily refresh failed: %v", err)
				}
				cancel()
			}

		case <-s.stopChan:
			return
		}
	}
}

// refresh performs the standard/live FX rate refresh
func (s *fxScheduler) refresh(ctx context.Context) error {
	// Get all positions to determine required pairs
	positions, err := s.uow.Position().FindWithFilters(ctx, repository.PositionFilter{})
	if err != nil {
		return fmt.Errorf("failed to get positions: %w", err)
	}

	// Resolve required currency pairs (deduplication)
	pairs := s.fxRateService.ResolvePairs(ctx, positions)
	if len(pairs) == 0 {
		// No positions, use default pairs
		pairs = supportedPairs
	}

	// Mark existing rates as stale before fetching new ones
	if err := s.markRatesStale(ctx, pairs); err != nil {
		log.Printf("[WARN] [FXScheduler] Warning: failed to mark rates stale: %v", err)
	}

	// Fetch and store new rates
	return s.fetchAndStoreRates(ctx, pairs)
}

// refreshDaily performs the end-of-day FX rate refresh
func (s *fxScheduler) refreshDaily(ctx context.Context) error {
	if err := s.backfillDailyGaps(ctx); err != nil {
		log.Printf("[WARN] [FXScheduler] Daily gap backfill during refreshDaily: %v", err)
	}

	// Use all supported pairs for daily refresh (historical record)
	pairs := supportedPairs

	log.Printf("[INFO] [FXScheduler] Performing daily refresh for %d pairs", len(pairs))
	// Fetch and store new daily rates without invalidating historical daily rates
	if err := s.fetchAndStoreRatesWithGranularity(ctx, pairs, model.FXRateGranularityDay); err != nil {
		return err
	}

	s.lastDailyRefresh = time.Now()
	log.Printf("[INFO] [FXScheduler] Daily refresh completed")
	return nil
}

// markRatesStale marks existing rates as stale before fetching new ones
func (s *fxScheduler) markRatesStale(ctx context.Context, pairs []model.CurrencyPair) error {
	now := time.Now().UTC()
	// Stale threshold accounts for 5-minute scheduler interval and weekend closures
	staleThreshold := 15 * time.Minute
	if now.Weekday() == time.Saturday || now.Weekday() == time.Sunday || (now.Weekday() == time.Monday && now.Hour() < 6) {
		// Forex markets close Friday ~21:00 UTC and reopen Sunday ~21:00 UTC.
		staleThreshold = 72 * time.Hour
	}
	olderThan := now.Add(-staleThreshold)
	for _, pair := range pairs {
		if err := s.uow.FXRate().MarkStale(ctx, pair.BaseCurrency, pair.QuoteCurrency, string(model.FXRateGranularityMinute), olderThan); err != nil {
			log.Printf("[WARN] [FXScheduler] Warning: failed to mark %s stale: %v", pair.String(), err)
		}
	}
	return nil
}

// markRatesStaleForGranularity marks existing rates of a specific granularity as stale
func (s *fxScheduler) markRatesStaleForGranularity(ctx context.Context, pairs []model.CurrencyPair, granularity model.FXRateGranularity) error {
	// Daily historical rates are immutable historical facts and must never be marked stale
	if granularity == model.FXRateGranularityDay {
		return nil
	}
	for _, pair := range pairs {
		olderThan := time.Now().Add(-24 * time.Hour)
		if err := s.uow.FXRate().MarkStale(ctx, pair.BaseCurrency, pair.QuoteCurrency, string(granularity), olderThan); err != nil {
			log.Printf("[WARN] [FXScheduler] Warning: failed to mark %s (%s) stale: %v", pair.String(), granularity, err)
		}
	}
	return nil
}

// fetchAndStoreRates fetches rates from provider and stores them
func (s *fxScheduler) fetchAndStoreRates(ctx context.Context, pairs []model.CurrencyPair) error {
	for _, pair := range pairs {
		quote, err := s.fetchRate(ctx, pair)
		if err != nil {
			log.Printf("[WARN] [FXScheduler] Warning: failed to fetch %s: %v", pair.String(), err)
			continue
		}

		asOf := quote.Timestamp
		// If the quote timestamp is date-only (midnight UTC) or zero, use current UTC observation time
		if asOf.IsZero() || (asOf.Hour() == 0 && asOf.Minute() == 0 && asOf.Second() == 0) {
			asOf = time.Now().UTC()
		}

		fxRate := &model.FXRate{
			BaseCurrency:  pair.BaseCurrency,
			QuoteCurrency: pair.QuoteCurrency,
			Rate:          quote.Last,
			AsOf:          asOf,
			Source:        quote.Source,
			Granularity:   model.FXRateGranularityMinute,
			IsStale:       false,
		}

		if err := s.uow.FXRate().SaveRate(ctx, fxRate); err != nil {
			log.Printf("[WARN] [FXScheduler] Warning: failed to store %s: %v", pair.String(), err)
			continue
		}

		log.Printf("[INFO] [FXScheduler] Stored %s rate: %s (source: %s)", pair.String(), quote.Last.String(), quote.Source)
	}

	return nil
}

// fetchAndStoreRatesWithGranularity fetches rates and stores with specific granularity
func (s *fxScheduler) fetchAndStoreRatesWithGranularity(ctx context.Context, pairs []model.CurrencyPair, granularity model.FXRateGranularity) error {
	for _, pair := range pairs {
		quote, err := s.fetchRate(ctx, pair)
		if err != nil {
			log.Printf("[WARN] [FXScheduler] Warning: failed to fetch %s for daily: %v", pair.String(), err)
			continue
		}

		fxRate := &model.FXRate{
			BaseCurrency:  pair.BaseCurrency,
			QuoteCurrency: pair.QuoteCurrency,
			Rate:          quote.Last,
			AsOf:          quote.Timestamp,
			Source:        quote.Source,
			Granularity:   granularity,
			IsStale:       false,
		}

		if err := s.uow.FXRate().SaveRate(ctx, fxRate); err != nil {
			log.Printf("[WARN] [FXScheduler] Warning: failed to store daily %s: %v", pair.String(), err)
			continue
		}

		log.Printf("[INFO] [FXScheduler] Stored daily %s rate: %s", pair.String(), quote.Last.String())
	}

	return nil
}

// fetchRate fetches a single rate from the provider
func (s *fxScheduler) fetchRate(ctx context.Context, pair model.CurrencyPair) (*providers.QuoteResponse, error) {
	symbol := pair.String()

	return s.provider.GetQuote(ctx, providers.QuoteRequest{
		Symbol:    symbol,
		AssetType: "FOREX",
		APIKey:    s.apiKey,
	})
}

// getIntervalForMode returns the refresh interval for a given mode
func (s *fxScheduler) getIntervalForMode(mode FXSchedulerMode) time.Duration {
	switch mode {
	case FXSchedulerModeLive:
		return liveInterval
	case FXSchedulerModeDaily:
		return 24 * time.Hour // Daily mode uses dailyTicker instead
	default:
		return standardInterval
	}
}

// shouldPerformDailyRefresh checks if it's time for a daily refresh
func (s *fxScheduler) shouldPerformDailyRefresh() bool {
	now := time.Now().UTC()

	// Check if we've already refreshed today
	if s.lastDailyRefresh.After(s.getStartOfTodayUTC()) {
		return false
	}

	// Check if current time is at or past market close (21:00 UTC)
	targetTime := time.Date(now.Year(), now.Month(), now.Day(), marketCloseHour, marketCloseMinute, 0, 0, time.UTC)
	return now.Equal(targetTime) || now.After(targetTime)
}

// getLastDailyRefreshTime returns the last daily refresh time or a time far in the past
func (s *fxScheduler) getLastDailyRefreshTime() time.Time {
	if s.lastDailyRefresh.IsZero() {
		// If never refreshed, return a time far in the past
		return time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
	}
	return s.lastDailyRefresh
}

// getStartOfTodayUTC returns midnight UTC of the current day
func (s *fxScheduler) getStartOfTodayUTC() time.Time {
	now := time.Now().UTC()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}

// GetSupportedPairs returns the list of supported currency pairs
func GetSupportedFXPairs() []model.CurrencyPair {
	return supportedPairs
}

// FormatFXRate formats an FX rate for logging/display
func FormatFXRate(rate *model.FXRate) string {
	if rate == nil {
		return "nil"
	}
	return fmt.Sprintf("%s/%s: %s (as_of: %s, source: %s, stale: %v)",
		rate.BaseCurrency, rate.QuoteCurrency, rate.Rate.String(),
		rate.AsOf.Format(time.RFC3339), rate.Source, rate.IsStale)
}
