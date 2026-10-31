package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Widen transaction currency columns ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.transactions
					ALTER COLUMN unit_price_currency TYPE varchar(10),
					ALTER COLUMN fees_currency TYPE varchar(10);
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Widen transaction currency columns ")
			// Narrowing is deliberately skipped: rows may already hold asset codes
			// longer than three characters (e.g. stablecoin quote legs such as USDT),
			// which the previous width cannot store.
			_, err := db.ExecContext(ctx, `SELECT 1;`)
			return err
		},
	)
}
