package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Relax instrument identifier indexes ")
			_, err := db.ExecContext(ctx, `
				DROP INDEX IF EXISTS sigma_finance.instruments_isin_unique;
				DROP INDEX IF EXISTS sigma_finance.instruments_figi_unique;
				DROP INDEX IF EXISTS sigma_finance.instruments_cusip_unique;

				CREATE INDEX IF NOT EXISTS instruments_isin_idx
					ON sigma_finance.instruments(isin)
					WHERE isin IS NOT NULL;
				CREATE INDEX IF NOT EXISTS instruments_figi_idx
					ON sigma_finance.instruments(figi)
					WHERE figi IS NOT NULL;
				CREATE INDEX IF NOT EXISTS instruments_cusip_idx
					ON sigma_finance.instruments(cusip)
					WHERE cusip IS NOT NULL;
			`)
			if err != nil {
				fmt.Printf(" (failed - %v) ", err)
				return err
			}
			fmt.Print(" (ok) ")
			return nil
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] ")
			_, err := db.ExecContext(ctx, `
				DROP INDEX IF EXISTS sigma_finance.instruments_cusip_idx;
				DROP INDEX IF EXISTS sigma_finance.instruments_figi_idx;
				DROP INDEX IF EXISTS sigma_finance.instruments_isin_idx;

				CREATE UNIQUE INDEX IF NOT EXISTS instruments_isin_unique
					ON sigma_finance.instruments(isin)
					WHERE isin IS NOT NULL;
				CREATE UNIQUE INDEX IF NOT EXISTS instruments_figi_unique
					ON sigma_finance.instruments(figi)
					WHERE figi IS NOT NULL;
				CREATE UNIQUE INDEX IF NOT EXISTS instruments_cusip_unique
					ON sigma_finance.instruments(cusip)
					WHERE cusip IS NOT NULL;
			`)
			if err != nil {
				fmt.Printf(" (failed - %v) ", err)
				return err
			}
			fmt.Print(" (ok) ")
			return nil
		},
	)
}
