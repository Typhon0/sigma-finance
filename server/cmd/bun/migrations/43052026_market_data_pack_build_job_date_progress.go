package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add market data pack build date progress columns ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.market_data_pack_build_jobs
					ADD COLUMN IF NOT EXISTS current_date DATE,
					ADD COLUMN IF NOT EXISTS current_asset_type TEXT,
					ADD COLUMN IF NOT EXISTS completed_dates INTEGER NOT NULL DEFAULT 0,
					ADD COLUMN IF NOT EXISTS total_dates INTEGER NOT NULL DEFAULT 0,
					ADD COLUMN IF NOT EXISTS rows_written BIGINT NOT NULL DEFAULT 0;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Add market data pack build date progress columns ")
			_, err := db.ExecContext(ctx, `SELECT 1;`)
			return err
		},
	)
}
