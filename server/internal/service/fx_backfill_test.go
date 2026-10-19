package service

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service/providers"

	"github.com/shopspring/decimal"
)

type testFXRepoStub struct {
	repository.IFXRateRepository
	rates               map[string]*model.FXRate // key: BASE/QUOTE@YYYY-MM-DD
	latestRates         map[string]*model.FXRate // key: BASE/QUOTE
	saveRatesCallCount  int
	savedRates          []*model.FXRate
}

func newTestFXRepoStub() *testFXRepoStub {
	return &testFXRepoStub{
		rates:       make(map[string]*model.FXRate),
		latestRates: make(map[string]*model.FXRate),
	}
}

func (r *testFXRepoStub) GetLatestRate(ctx context.Context, base, quote model.Currency) (*model.FXRate, error) {
	key := fmt.Sprintf("%s/%s", base, quote)
	if rate, ok := r.latestRates[key]; ok {
		return rate, nil
	}
	return nil, sql.ErrNoRows
}

func (r *testFXRepoStub) GetLatestRateWithGranularity(ctx context.Context, base, quote model.Currency, granularity model.FXRateGranularity) (*model.FXRate, error) {
	key := fmt.Sprintf("%s/%s", base, quote)
	if rate, ok := r.latestRates[key]; ok && rate.Granularity == granularity {
		return rate, nil
	}
	return nil, sql.ErrNoRows
}

func (r *testFXRepoStub) GetHistoricalRate(ctx context.Context, base, quote model.Currency, date time.Time) (*model.FXRate, error) {
	key := fmt.Sprintf("%s/%s@%s", base, quote, date.Format("2006-01-02"))
	if rate, ok := r.rates[key]; ok {
		return rate, nil
	}
	// Also search for closest as_of <= date
	var closest *model.FXRate
	for _, rate := range r.rates {
		if rate.BaseCurrency == base && rate.QuoteCurrency == quote && !rate.AsOf.After(date) {
			if closest == nil || rate.AsOf.After(closest.AsOf) {
				closest = rate
			}
		}
	}
	if closest != nil {
		return closest, nil
	}
	return nil, sql.ErrNoRows
}

func (r *testFXRepoStub) SaveRate(ctx context.Context, rate *model.FXRate) error {
	return r.SaveRates(ctx, []*model.FXRate{rate})
}

func (r *testFXRepoStub) SaveRates(ctx context.Context, rates []*model.FXRate) error {
	r.saveRatesCallCount++
	for _, rate := range rates {
		key := fmt.Sprintf("%s/%s@%s", rate.BaseCurrency, rate.QuoteCurrency, rate.AsOf.Format("2006-01-02"))
		r.rates[key] = rate
		pairKey := fmt.Sprintf("%s/%s", rate.BaseCurrency, rate.QuoteCurrency)
		if existing, ok := r.latestRates[pairKey]; !ok || rate.AsOf.After(existing.AsOf) {
			r.latestRates[pairKey] = rate
		}
		r.savedRates = append(r.savedRates, rate)
	}
	return nil
}

func (r *testFXRepoStub) MarkStale(ctx context.Context, base, quote model.Currency, granularity string, olderThan time.Time) error {
	return nil
}

type testUOWStub struct {
	repository.IUnitOfWork
	fxRepo *testFXRepoStub
}

func (u *testUOWStub) FXRate() repository.IFXRateRepository {
	return u.fxRepo
}

func (u *testUOWStub) Position() repository.IPositionRepository {
	return &testPositionRepoStub{}
}

type testPositionRepoStub struct {
	repository.IPositionRepository
}

func (p *testPositionRepoStub) FindWithFilters(ctx context.Context, filter repository.PositionFilter) ([]model.Position, error) {
	return []model.Position{}, nil
}

type testProviderStub struct {
	providers.Provider
	getCandlesCalls []providers.CandleRequest
	candlesToReturn map[string][]model.Candle // key: symbol
}

func newTestProviderStub() *testProviderStub {
	return &testProviderStub{
		candlesToReturn: make(map[string][]model.Candle),
	}
}

func (p *testProviderStub) GetCandles(ctx context.Context, req providers.CandleRequest) (*providers.CandleResponse, error) {
	p.getCandlesCalls = append(p.getCandlesCalls, req)
	candles := p.candlesToReturn[req.Symbol]
	return &providers.CandleResponse{
		Candles:   candles,
		Source:    "TEST_STUB",
		Timestamp: time.Now(),
	}, nil
}

func (p *testProviderStub) GetQuote(ctx context.Context, req providers.QuoteRequest) (*providers.QuoteResponse, error) {
	return &providers.QuoteResponse{
		Symbol:    req.Symbol,
		Last:      decimal.NewFromFloat(1.10),
		Timestamp: time.Now(),
		Source:    "TEST_STUB",
	}, nil
}

func TestFXRateService_GetHistoricalRate_BackfillCalendarYear(t *testing.T) {
	uow := &testUOWStub{fxRepo: newTestFXRepoStub()}
	provider := newTestProviderStub()

	// Prepare mock 2017 candles returned in 1 batch
	var year2017Candles []model.Candle
	for day := 1; day <= 250; day++ {
		candleDate := time.Date(2017, 1, 1, 0, 0, 0, 0, time.UTC).AddDate(0, 0, day)
		year2017Candles = append(year2017Candles, model.Candle{
			Symbol:    "EUR/USD",
			Close:     decimal.NewFromFloat(1.05 + float64(day)*0.0005),
			Timestamp: candleDate,
			Source:    "frankfurter",
		})
	}
	provider.candlesToReturn["EUR/USD"] = year2017Candles

	svc := NewFXRateServiceWithProvider(uow, 60, provider)

	// Query historical date in 2017 (which is missing in empty DB)
	targetDate := time.Date(2017, 6, 15, 14, 30, 0, 0, time.UTC)
	rate, err := svc.GetHistoricalRate(context.Background(), model.CurrencyEUR, model.CurrencyUSD, targetDate)
	if err != nil {
		t.Fatalf("expected rate backfill to succeed, got error: %v", err)
	}

	if rate == nil {
		t.Fatalf("expected non-nil rate")
	}

	// 1. Provider must have been called exactly once for the whole year
	if len(provider.getCandlesCalls) != 1 {
		t.Fatalf("expected 1 batch provider call for calendar year, got %d", len(provider.getCandlesCalls))
	}
	firstCall := provider.getCandlesCalls[0]
	if firstCall.From.Year() != 2017 || firstCall.To.Year() != 2017 {
		t.Errorf("expected 2017 year range, got from=%s to=%s", firstCall.From, firstCall.To)
	}

	// 2. All 250 trading days must now be saved in the repository
	if len(uow.fxRepo.rates) != 250 {
		t.Fatalf("expected 250 rates persisted, got %d", len(uow.fxRepo.rates))
	}

	// 3. Second query for a different 2017 date must hit repo immediately with NO extra provider call
	provider.getCandlesCalls = nil
	secondDate := time.Date(2017, 8, 20, 10, 0, 0, 0, time.UTC)
	secondRate, err := svc.GetHistoricalRate(context.Background(), model.CurrencyEUR, model.CurrencyUSD, secondDate)
	if err != nil {
		t.Fatalf("second query failed: %v", err)
	}
	if secondRate == nil {
		t.Fatalf("expected second rate")
	}
	if len(provider.getCandlesCalls) != 0 {
		t.Errorf("expected 0 provider calls for subsequent lookup in same year, got %d", len(provider.getCandlesCalls))
	}
}

func TestFXScheduler_BackfillDailyGaps(t *testing.T) {
	fxRepo := newTestFXRepoStub()
	uow := &testUOWStub{fxRepo: fxRepo}
	provider := newTestProviderStub()

	// Seed EUR/USD with a rate from 5 days ago
	fiveDaysAgo := time.Now().UTC().AddDate(0, 0, -5)
	fxRepo.latestRates["EUR/USD"] = &model.FXRate{
		BaseCurrency:  model.CurrencyEUR,
		QuoteCurrency: model.CurrencyUSD,
		Rate:          decimal.NewFromFloat(1.12),
		AsOf:          fiveDaysAgo,
		Granularity:   model.FXRateGranularityDay,
	}

	// Seed GBP/USD with today's rate (no gap)
	todayRate := time.Now().UTC().Add(-2 * time.Hour)
	fxRepo.latestRates["GBP/USD"] = &model.FXRate{
		BaseCurrency:  model.CurrencyGBP,
		QuoteCurrency: model.CurrencyUSD,
		Rate:          decimal.NewFromFloat(1.30),
		AsOf:          todayRate,
		Granularity:   model.FXRateGranularityDay,
	}

	// Prepare mock candles returned for EUR/USD gap
	provider.candlesToReturn["EUR/USD"] = []model.Candle{
		{Symbol: "EUR/USD", Close: decimal.NewFromFloat(1.121), Timestamp: fiveDaysAgo.AddDate(0, 0, 1), Source: "frankfurter"},
		{Symbol: "EUR/USD", Close: decimal.NewFromFloat(1.122), Timestamp: fiveDaysAgo.AddDate(0, 0, 2), Source: "frankfurter"},
		{Symbol: "EUR/USD", Close: decimal.NewFromFloat(1.123), Timestamp: fiveDaysAgo.AddDate(0, 0, 3), Source: "frankfurter"},
		{Symbol: "EUR/USD", Close: decimal.NewFromFloat(1.124), Timestamp: fiveDaysAgo.AddDate(0, 0, 4), Source: "frankfurter"},
	}

	scheduler := &fxScheduler{
		uow:           uow,
		fxRateService: NewFXRateServiceWithProvider(uow, 60, provider),
		provider:      provider,
	}

	err := scheduler.backfillDailyGaps(context.Background())
	if err != nil {
		t.Fatalf("backfillDailyGaps failed: %v", err)
	}

	// Check that EUR/USD was backfilled
	if len(provider.getCandlesCalls) < 1 {
		t.Fatalf("expected at least 1 provider call for EUR/USD gap, got %d", len(provider.getCandlesCalls))
	}

	foundEURUSD := false
	for _, call := range provider.getCandlesCalls {
		if call.Symbol == "EUR/USD" {
			foundEURUSD = true
			if !call.From.After(fiveDaysAgo) {
				t.Errorf("expected backfill from after %s, got %s", fiveDaysAgo, call.From)
			}
		}
		if call.Symbol == "GBP/USD" {
			t.Errorf("GBP/USD was up to date and should NOT have triggered a backfill call")
		}
	}

	if !foundEURUSD {
		t.Errorf("did not find expected backfill call for EUR/USD")
	}

	// Verify that rates were saved
	if len(fxRepo.savedRates) != 4 {
		t.Errorf("expected 4 saved rates for EUR/USD gap, got %d", len(fxRepo.savedRates))
	}
}
