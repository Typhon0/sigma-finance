package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/uptrace/bun"
)

// IFXRateRepository defines the interface for FX rate repository operations
type IFXRateRepository interface {
	GetLatestRate(ctx context.Context, base, quote model.Currency) (*model.FXRate, error)
	GetHistoricalRate(ctx context.Context, base, quote model.Currency, date time.Time) (*model.FXRate, error)
	GetRateForDate(ctx context.Context, base, quote model.Currency, date time.Time) (*model.FXRate, error)
	SaveRate(ctx context.Context, rate *model.FXRate) error
	SaveRates(ctx context.Context, rates []*model.FXRate) error
	GetLatestRatesForPairs(ctx context.Context, pairs []model.CurrencyPair) ([]*model.FXRate, error)
	MarkStale(ctx context.Context, base, quote model.Currency, granularity string, olderThan time.Time) error
}

// FXRateRepository is the concrete implementation of IFXRateRepository
type FXRateRepository struct {
	*Repository[model.FXRate]
	db bun.IDB
}

// NewFXRateRepository creates a new FXRateRepository
func NewFXRateRepository(db bun.IDB) *FXRateRepository {
	return &FXRateRepository{
		Repository: NewRepository[model.FXRate](db),
		db:         db,
	}
}

// GetLatestRate retrieves the most recent rate for a currency pair
func (r *FXRateRepository) GetLatestRate(ctx context.Context, base, quote model.Currency) (*model.FXRate, error) {
	var rate model.FXRate
	err := r.db.NewSelect().
		Model(&rate).
		Where("base_currency = ?", base).
		Where("quote_currency = ?", quote).
		Order("as_of DESC").
		Limit(1).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return &rate, nil
}

// GetHistoricalRate retrieves the rate closest to a specific date/time
func (r *FXRateRepository) GetHistoricalRate(ctx context.Context, base, quote model.Currency, date time.Time) (*model.FXRate, error) {
	var rate model.FXRate
	err := r.db.NewSelect().
		Model(&rate).
		Where("base_currency = ?", base).
		Where("quote_currency = ?", quote).
		Where("as_of <= ?", date).
		Order("as_of DESC").
		Limit(1).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return &rate, nil
}

// GetRateForDate retrieves the rate for a specific date (start of day)
func (r *FXRateRepository) GetRateForDate(ctx context.Context, base, quote model.Currency, date time.Time) (*model.FXRate, error) {
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	var rate model.FXRate
	err := r.db.NewSelect().
		Model(&rate).
		Where("base_currency = ?", base).
		Where("quote_currency = ?", quote).
		Where("as_of >= ?", startOfDay).
		Where("as_of < ?", endOfDay).
		Order("as_of DESC").
		Limit(1).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return &rate, nil
}

// SaveRate persists a single FX rate
func (r *FXRateRepository) SaveRate(ctx context.Context, rate *model.FXRate) error {
	_, err := r.db.NewInsert().
		Model(rate).
		Returning("*").
		Exec(ctx)
	return err
}

// SaveRates persists multiple FX rates in a batch
func (r *FXRateRepository) SaveRates(ctx context.Context, rates []*model.FXRate) error {
	if len(rates) == 0 {
		return nil
	}

	_, err := r.db.NewInsert().
		Model(&rates).
		Returning("*").
		Exec(ctx)
	return err
}

// GetLatestRatesForPairs retrieves the latest rates for multiple currency pairs
func (r *FXRateRepository) GetLatestRatesForPairs(ctx context.Context, pairs []model.CurrencyPair) ([]*model.FXRate, error) {
	if len(pairs) == 0 {
		return []*model.FXRate{}, nil
	}

	// Build list of pair strings for IN query
	var pairStrings []string
	for _, p := range pairs {
		pairStrings = append(pairStrings, p.BaseCurrency.String()+":"+p.QuoteCurrency.String())
	}

	var rates []*model.FXRate
	err := r.db.NewSelect().
		Model(&rates).
		Where("(base_currency || ':' || quote_currency) IN (?)", bun.In(pairStrings)).
		Where("as_of = (SELECT MAX(as_of) FROM sigma_finance.fx_rates r2 WHERE r2.base_currency = fx_rates.base_currency AND r2.quote_currency = fx_rates.quote_currency)").
		Scan(ctx)
	if err != nil {
		return nil, err
	}

	return rates, nil
}

// MarkStale marks rates as stale that are older than the specified time
func (r *FXRateRepository) MarkStale(ctx context.Context, base, quote model.Currency, granularity string, olderThan time.Time) error {
	_, err := r.db.NewUpdate().
		Model((*model.FXRate)(nil)).
		Set("is_stale = true").
		Where("base_currency = ?", base).
		Where("quote_currency = ?", quote).
		Where("granularity = ?", granularity).
		Where("as_of < ?", olderThan).
		Exec(ctx)
	return err
}
