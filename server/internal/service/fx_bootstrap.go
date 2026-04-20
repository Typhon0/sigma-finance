package service

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

// ensureFXRatesTable creates the FX rates table when older environments are missing it.
// This keeps runtime conversion functional even if a historical migration state is inconsistent.
func ensureFXRatesTable(ctx context.Context, db bun.IDB) error {
	_, err := db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS sigma_finance.fx_rates (
			id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
			base_currency VARCHAR(3) NOT NULL,
			quote_currency VARCHAR(3) NOT NULL,
			rate DECIMAL(20, 10) NOT NULL,
			as_of TIMESTAMP NOT NULL,
			source VARCHAR(50) NOT NULL,
			granularity VARCHAR(20) NOT NULL,
			is_stale BOOLEAN DEFAULT FALSE NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
			UNIQUE (base_currency, quote_currency, as_of, granularity)
		);

		CREATE INDEX IF NOT EXISTS idx_fx_rates_currencies
			ON sigma_finance.fx_rates(base_currency, quote_currency);
		CREATE INDEX IF NOT EXISTS idx_fx_rates_as_of
			ON sigma_finance.fx_rates(as_of);
		CREATE INDEX IF NOT EXISTS idx_fx_rates_pair_as_of
			ON sigma_finance.fx_rates(base_currency, quote_currency, as_of DESC);
		CREATE INDEX IF NOT EXISTS idx_fx_rates_pair_granularity_as_of
			ON sigma_finance.fx_rates(base_currency, quote_currency, granularity, as_of DESC);
	`)
	if err != nil {
		return fmt.Errorf("ensure fx_rates table: %w", err)
	}
	return nil
}
