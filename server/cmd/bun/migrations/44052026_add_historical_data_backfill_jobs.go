package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add historical data backfill jobs ")
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
					finished_at TIMESTAMPTZ,
					CONSTRAINT historical_data_backfill_jobs_status_check CHECK (status IN ('QUEUED','RUNNING','COMPLETE','ERROR','SKIPPED_UNSUPPORTED')),
					CONSTRAINT historical_data_backfill_jobs_step_check CHECK (step IN ('QUEUED','FETCH_PRICES','CALCULATE_PERFORMANCE','DONE','FAILED')),
					CONSTRAINT historical_data_backfill_jobs_progress_check CHECK (progress >= 0 AND progress <= 100)
				);

				CREATE INDEX IF NOT EXISTS idx_hist_backfill_jobs_asset_created
					ON sigma_finance.historical_data_backfill_jobs(asset_id, created_at DESC);
				CREATE INDEX IF NOT EXISTS idx_hist_backfill_jobs_portfolio_created
					ON sigma_finance.historical_data_backfill_jobs(portfolio_id, created_at DESC);
				CREATE INDEX IF NOT EXISTS idx_hist_backfill_jobs_status
					ON sigma_finance.historical_data_backfill_jobs(status);
				CREATE INDEX IF NOT EXISTS idx_hist_backfill_jobs_user_created
					ON sigma_finance.historical_data_backfill_jobs(user_id, created_at DESC);
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Add historical data backfill jobs ")
			_, err := db.ExecContext(ctx, `SELECT 1;`)
			return err
		},
	)
}
