package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add instrument expense_ratio and dividend_yield reference metrics ")

			// Both columns are nullable on purpose. A NULL means "the provider
			// has not told us", which is a different statement from 0.00 and the
			// difference matters: a 0.15% expense ratio invented for an unknown
			// fund is a number the user would budget against.
			//
			// The client previously resolved TER from a hardcoded symbol table
			// (VOO -> 0.03) and a name-substring heuristic ("vanguard" -> 0.05,
			// fallback 0.15). Those values are not this fund's TER, they are the
			// author's guess at an average, and they are presented to the user as
			// an annual drag in currency. The column is nullable so that "unknown"
			// survives the round trip instead of being flattened to a default.
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.instruments
					ADD COLUMN IF NOT EXISTS expense_ratio DECIMAL(8,6);

				ALTER TABLE sigma_finance.instruments
					ADD COLUMN IF NOT EXISTS dividend_yield DECIMAL(8,6);

				COMMENT ON COLUMN sigma_finance.instruments.expense_ratio IS
					'Annual total expense ratio as a percentage (0.03 = 3%). NULL when unknown.';
				COMMENT ON COLUMN sigma_finance.instruments.dividend_yield IS
					'Annual dividend yield as a percentage (1.85 = 1.85%). NULL when unknown.';
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Drop instrument expense_ratio and dividend_yield ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.instruments DROP COLUMN IF EXISTS dividend_yield;
				ALTER TABLE sigma_finance.instruments DROP COLUMN IF EXISTS expense_ratio;
			`)
			return err
		},
	)
}
