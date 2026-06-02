package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Repair historical data backfill jobs table ")
			_, err := db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.historical_data_backfill_jobs (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID,
					portfolio_id UUID NOT NULL,
					asset_id UUID NOT NULL,
					instrument_id UUID NOT NULL,
					provider TEXT NOT NULL DEFAULT 'YFINANCE',
					status TEXT NOT NULL,
					step TEXT NOT NULL DEFAULT 'QUEUED',
					progress INTEGER NOT NULL DEFAULT 0,
					rows_written INTEGER NOT NULL DEFAULT 0,
					error_code TEXT,
					error_message TEXT,
					requested_from TIMESTAMPTZ NOT NULL,
					requested_to TIMESTAMPTZ NOT NULL,
					created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
					started_at TIMESTAMPTZ,
					finished_at TIMESTAMPTZ
				);

				ALTER TABLE sigma_finance.historical_data_backfill_jobs
					ADD COLUMN IF NOT EXISTS user_id UUID,
					ADD COLUMN IF NOT EXISTS portfolio_id UUID,
					ADD COLUMN IF NOT EXISTS asset_id UUID,
					ADD COLUMN IF NOT EXISTS instrument_id UUID,
					ADD COLUMN IF NOT EXISTS provider TEXT,
					ADD COLUMN IF NOT EXISTS status TEXT,
					ADD COLUMN IF NOT EXISTS step TEXT,
					ADD COLUMN IF NOT EXISTS progress INTEGER,
					ADD COLUMN IF NOT EXISTS rows_written INTEGER,
					ADD COLUMN IF NOT EXISTS error_code TEXT,
					ADD COLUMN IF NOT EXISTS error_message TEXT,
					ADD COLUMN IF NOT EXISTS requested_from TIMESTAMPTZ,
					ADD COLUMN IF NOT EXISTS requested_to TIMESTAMPTZ,
					ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
					ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
					ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

				ALTER TABLE sigma_finance.historical_data_backfill_jobs
					ALTER COLUMN provider SET DEFAULT 'YFINANCE',
					ALTER COLUMN step SET DEFAULT 'QUEUED',
					ALTER COLUMN progress SET DEFAULT 0,
					ALTER COLUMN rows_written SET DEFAULT 0,
					ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

				UPDATE sigma_finance.historical_data_backfill_jobs
				SET provider = COALESCE(NULLIF(provider, ''), 'YFINANCE'),
					step = COALESCE(NULLIF(step, ''), 'QUEUED'),
					progress = COALESCE(progress, 0),
					rows_written = COALESCE(rows_written, 0),
					created_at = COALESCE(created_at, CURRENT_TIMESTAMP)
				WHERE provider IS NULL
					OR step IS NULL
					OR progress IS NULL
					OR rows_written IS NULL
					OR created_at IS NULL;

				CREATE INDEX IF NOT EXISTS idx_hist_backfill_jobs_asset_created
					ON sigma_finance.historical_data_backfill_jobs(asset_id, created_at DESC);
				CREATE INDEX IF NOT EXISTS idx_hist_backfill_jobs_portfolio_created
					ON sigma_finance.historical_data_backfill_jobs(portfolio_id, created_at DESC);
				CREATE INDEX IF NOT EXISTS idx_hist_backfill_jobs_status
					ON sigma_finance.historical_data_backfill_jobs(status);
				CREATE INDEX IF NOT EXISTS idx_hist_backfill_jobs_user_created
					ON sigma_finance.historical_data_backfill_jobs(user_id, created_at DESC);

				DO $$
				BEGIN
					IF NOT EXISTS (
						SELECT 1
						FROM pg_constraint
						WHERE conname = 'historical_data_backfill_jobs_status_check'
					) THEN
						ALTER TABLE sigma_finance.historical_data_backfill_jobs
						ADD CONSTRAINT historical_data_backfill_jobs_status_check
						CHECK (status IN ('QUEUED','RUNNING','COMPLETE','ERROR','SKIPPED_UNSUPPORTED'));
					END IF;
				END$$;

				DO $$
				BEGIN
					IF NOT EXISTS (
						SELECT 1
						FROM pg_constraint
						WHERE conname = 'historical_data_backfill_jobs_step_check'
					) THEN
						ALTER TABLE sigma_finance.historical_data_backfill_jobs
						ADD CONSTRAINT historical_data_backfill_jobs_step_check
						CHECK (step IN ('QUEUED','FETCH_PRICES','CALCULATE_PERFORMANCE','DONE','FAILED'));
					END IF;
				END$$;

				DO $$
				BEGIN
					IF NOT EXISTS (
						SELECT 1
						FROM pg_constraint
						WHERE conname = 'historical_data_backfill_jobs_progress_check'
					) THEN
						ALTER TABLE sigma_finance.historical_data_backfill_jobs
						ADD CONSTRAINT historical_data_backfill_jobs_progress_check
						CHECK (progress >= 0 AND progress <= 100);
					END IF;
				END$$;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Repair historical data backfill jobs table ")
			_, err := db.ExecContext(ctx, `SELECT 1;`)
			return err
		},
	)
}
