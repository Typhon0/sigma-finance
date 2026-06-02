package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add combined instrument trigram index ")
			_, err := db.ExecContext(ctx, `
				CREATE INDEX IF NOT EXISTS instruments_normalized_symbol_name_trgm_idx
					ON sigma_finance.instruments USING GIN (normalized_symbol gin_trgm_ops, normalized_name gin_trgm_ops);
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
				DROP INDEX IF EXISTS sigma_finance.instruments_normalized_symbol_name_trgm_idx;
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
