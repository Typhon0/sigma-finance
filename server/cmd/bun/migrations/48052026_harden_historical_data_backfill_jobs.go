package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Harden historical backfill jobs ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.historical_data_backfill_jobs
					ADD COLUMN IF NOT EXISTS rows_inserted INTEGER NOT NULL DEFAULT 0,
					ADD COLUMN IF NOT EXISTS rows_updated INTEGER NOT NULL DEFAULT 0,
					ADD COLUMN IF NOT EXISTS rows_skipped INTEGER NOT NULL DEFAULT 0,
					ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
					ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 4,
					ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT current_timestamp,
					ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE NULL,
					ADD COLUMN IF NOT EXISTS locked_by TEXT NULL,
					ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMP WITH TIME ZONE NULL,
					ADD COLUMN IF NOT EXISTS coverage_from TIMESTAMP WITH TIME ZONE NULL,
					ADD COLUMN IF NOT EXISTS coverage_to TIMESTAMP WITH TIME ZONE NULL,
					ADD COLUMN IF NOT EXISTS provider_symbol TEXT NULL;

				UPDATE sigma_finance.historical_data_backfill_jobs
				SET next_run_at = COALESCE(next_run_at, created_at, current_timestamp)
				WHERE next_run_at IS NULL;

				CREATE INDEX IF NOT EXISTS idx_hdbj_status_next_run
					ON sigma_finance.historical_data_backfill_jobs(status, next_run_at, created_at);
				CREATE INDEX IF NOT EXISTS idx_hdbj_locked_at
					ON sigma_finance.historical_data_backfill_jobs(locked_at);

				CREATE UNIQUE INDEX IF NOT EXISTS idx_hdbj_active_request_unique
					ON sigma_finance.historical_data_backfill_jobs(
						portfolio_id,
						asset_id,
						instrument_id,
						provider,
						requested_from,
						requested_to
					)
					WHERE status IN ('QUEUED', 'RUNNING');

				DO $$
				BEGIN
					CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_default
						PARTITION OF sigma_finance.asset_prices DEFAULT;
				EXCEPTION WHEN OTHERS THEN
					NULL;
				END $$;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Harden historical backfill jobs ")
			_, err := db.ExecContext(ctx, `
				DROP INDEX IF EXISTS sigma_finance.idx_hdbj_status_next_run;
				DROP INDEX IF EXISTS sigma_finance.idx_hdbj_locked_at;
				DROP INDEX IF EXISTS sigma_finance.idx_hdbj_active_request_unique;
			`)
			return err
		},
	)
}
