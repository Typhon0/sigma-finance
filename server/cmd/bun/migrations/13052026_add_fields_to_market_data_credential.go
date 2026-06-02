package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add is_enabled, priority, last_validated_at to market_data_credential ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.market_data_credential
				ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT true,
				ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 100,
				ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Remove is_enabled, priority, last_validated_at from market_data_credential ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.market_data_credential
				DROP COLUMN IF EXISTS is_enabled,
				DROP COLUMN IF EXISTS priority,
				DROP COLUMN IF EXISTS last_validated_at;
			`)
			return err
		},
	)
}
