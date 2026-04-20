package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add fx_rates table ")
			_, err := db.ExecContext(ctx, `
				CREATE TABLE sigma_finance.fx_rates (
					id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
					base_currency VARCHAR(3) NOT NULL,
					quote_currency VARCHAR(3) NOT NULL,
					rate DECIMAL(20, 12) NOT NULL,
					as_of TIMESTAMP NOT NULL,
					source VARCHAR(50) NOT NULL,
					granularity VARCHAR(20) NOT NULL,
					is_stale BOOLEAN DEFAULT FALSE,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					UNIQUE (base_currency, quote_currency, as_of, granularity)
				);
				CREATE INDEX idx_fx_rates_currencies ON sigma_finance.fx_rates(base_currency, quote_currency);
				CREATE INDEX idx_fx_rates_as_of ON sigma_finance.fx_rates(as_of);
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Drop fx_rates table ")
			_, err := db.ExecContext(ctx, `DROP TABLE IF EXISTS sigma_finance.fx_rates;`)
			return err
		},
	)
}
