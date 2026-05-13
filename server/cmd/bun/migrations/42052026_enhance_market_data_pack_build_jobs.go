package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Enhance market data pack build jobs ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.market_data_pack_build_job_items
					ADD COLUMN IF NOT EXISTS provider_error_code TEXT,
					ADD COLUMN IF NOT EXISTS http_status INTEGER,
					ADD COLUMN IF NOT EXISTS retryable BOOLEAN;

				ALTER TABLE sigma_finance.market_data_pack_build_jobs
					DROP CONSTRAINT IF EXISTS market_data_pack_build_jobs_status_check;

				ALTER TABLE sigma_finance.market_data_pack_build_jobs
					ADD CONSTRAINT market_data_pack_build_jobs_status_check
					CHECK (status IN ('queued','running','succeeded','partial','failed','canceled'));
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Enhance market data pack build jobs ")
			_, err := db.ExecContext(ctx, `SELECT 1;`)
			return err
		},
	)
}
