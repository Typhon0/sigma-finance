package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Relax catalog symbol/exchange uniqueness ")
			_, err := db.ExecContext(ctx, `
				DROP INDEX IF EXISTS sigma_finance.instruments_symbol_exchange_type_unique;

				CREATE INDEX IF NOT EXISTS instruments_symbol_exchange_type_idx
					ON sigma_finance.instruments(normalized_symbol, exchange, asset_type);
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
				DROP INDEX IF EXISTS sigma_finance.instruments_symbol_exchange_type_idx;

				CREATE UNIQUE INDEX IF NOT EXISTS instruments_symbol_exchange_type_unique
					ON sigma_finance.instruments(normalized_symbol, exchange, asset_type);
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
