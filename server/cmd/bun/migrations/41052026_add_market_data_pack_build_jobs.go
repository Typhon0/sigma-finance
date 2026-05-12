package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add market data pack local build jobs ")
			_, err := db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.market_data_pack_build_jobs (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID NOT NULL REFERENCES sigma_finance.users(id) ON DELETE CASCADE,
					pack_id TEXT NOT NULL,
					source_provider TEXT NOT NULL,
					build_config JSONB NOT NULL DEFAULT '{}'::jsonb,
					status TEXT NOT NULL,
					progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
					current_symbol TEXT,
					total_symbols INTEGER NOT NULL DEFAULT 0,
					completed_symbols INTEGER NOT NULL DEFAULT 0,
					failed_symbols INTEGER NOT NULL DEFAULT 0,
					error_message TEXT,
					created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
					started_at TIMESTAMPTZ,
					finished_at TIMESTAMPTZ,
					CONSTRAINT market_data_pack_build_jobs_status_check CHECK (status IN ('queued','running','succeeded','failed','canceled'))
				);

				CREATE INDEX IF NOT EXISTS idx_market_data_pack_build_jobs_status
					ON sigma_finance.market_data_pack_build_jobs(status);
				CREATE INDEX IF NOT EXISTS idx_market_data_pack_build_jobs_created_at
					ON sigma_finance.market_data_pack_build_jobs(created_at DESC);
				CREATE INDEX IF NOT EXISTS idx_market_data_pack_build_jobs_user_created
					ON sigma_finance.market_data_pack_build_jobs(user_id, created_at DESC);

				CREATE TABLE IF NOT EXISTS sigma_finance.market_data_pack_build_job_items (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					job_id UUID NOT NULL REFERENCES sigma_finance.market_data_pack_build_jobs(id) ON DELETE CASCADE,
					instrument_id UUID NOT NULL REFERENCES sigma_finance.instruments(id) ON DELETE CASCADE,
					symbol TEXT NOT NULL,
					status TEXT NOT NULL,
					first_date DATE,
					last_date DATE,
					attempt_count INTEGER NOT NULL DEFAULT 0,
					next_retry_at TIMESTAMPTZ,
					error_message TEXT,
					CONSTRAINT market_data_pack_build_job_items_status_check CHECK (status IN ('queued','running','succeeded','failed','canceled'))
				);

				CREATE INDEX IF NOT EXISTS idx_market_data_pack_build_job_items_job_id
					ON sigma_finance.market_data_pack_build_job_items(job_id);
				CREATE INDEX IF NOT EXISTS idx_market_data_pack_build_job_items_next_retry_at
					ON sigma_finance.market_data_pack_build_job_items(next_retry_at);
				CREATE UNIQUE INDEX IF NOT EXISTS uq_market_data_pack_build_job_items_job_instrument
					ON sigma_finance.market_data_pack_build_job_items(job_id, instrument_id);
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Add market data pack local build jobs ")
			_, err := db.ExecContext(ctx, `SELECT 1;`)
			return err
		},
	)
}
