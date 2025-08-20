package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add description and sort_order to portfolio table ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.portfolio 
				ADD COLUMN IF NOT EXISTS description TEXT,
				ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Remove description and sort_order from portfolio table ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.portfolio 
				DROP COLUMN IF EXISTS description,
				DROP COLUMN IF EXISTS sort_order;
			`)
			return err
		},
	)
}
