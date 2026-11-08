package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add ownership_percentage to sigma_finance.accounts ")

			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.accounts
				ADD COLUMN IF NOT EXISTS ownership_percentage numeric(5,2) NOT NULL DEFAULT 100.00;

				DO $$
				BEGIN
					IF NOT EXISTS (
						SELECT 1 FROM pg_constraint WHERE conname = 'accounts_ownership_percentage_check'
					) THEN
						ALTER TABLE sigma_finance.accounts
						ADD CONSTRAINT accounts_ownership_percentage_check
						CHECK (ownership_percentage > 0 AND ownership_percentage <= 100);
					END IF;
				END $$;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Drop ownership_percentage from sigma_finance.accounts ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.accounts
				DROP CONSTRAINT IF EXISTS accounts_ownership_percentage_check;

				ALTER TABLE sigma_finance.accounts
				DROP COLUMN IF EXISTS ownership_percentage;
			`)
			return err
		},
	)
}
