package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Repair market data pack tables ")
			_, err := db.ExecContext(ctx, `
				CREATE SCHEMA IF NOT EXISTS sigma_finance;

				CREATE TABLE IF NOT EXISTS sigma_finance.market_data_packs (
					id TEXT PRIMARY KEY,
					version TEXT NOT NULL,
					name TEXT NOT NULL,
					description TEXT,
					format_version INTEGER NOT NULL,
					status TEXT NOT NULL,
					parent_pack_id TEXT REFERENCES sigma_finance.market_data_packs(id) ON DELETE SET NULL,
					pack_priority INTEGER NOT NULL DEFAULT 0,
					file_path TEXT NOT NULL,
					checksum TEXT NOT NULL,
					signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
					assets_count BIGINT NOT NULL DEFAULT 0,
					rows_count BIGINT NOT NULL DEFAULT 0,
					installed_at TIMESTAMPTZ,
					updated_at TIMESTAMPTZ,
					created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
					CONSTRAINT market_data_packs_status_check CHECK (status IN ('available','installing','installed','failed','removed'))
				);

				CREATE TABLE IF NOT EXISTS sigma_finance.market_data_pack_coverage (
					pack_id TEXT NOT NULL REFERENCES sigma_finance.market_data_packs(id) ON DELETE CASCADE,
					instrument_id UUID NOT NULL,
					symbol TEXT NOT NULL,
					asset_type TEXT NOT NULL,
					interval TEXT NOT NULL,
					quote_currency TEXT NOT NULL,
					first_date DATE NOT NULL,
					last_date DATE NOT NULL,
					row_count BIGINT NOT NULL,
					file_paths JSONB NOT NULL,
					PRIMARY KEY (pack_id, instrument_id, interval, quote_currency)
				);

				CREATE INDEX IF NOT EXISTS idx_market_data_pack_coverage_instrument
					ON sigma_finance.market_data_pack_coverage(instrument_id, interval, quote_currency, last_date DESC);

				CREATE TABLE IF NOT EXISTS sigma_finance.market_data_pack_jobs (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					pack_id TEXT NOT NULL,
					job_type TEXT NOT NULL,
					status TEXT NOT NULL,
					progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
					downloaded_bytes BIGINT NOT NULL DEFAULT 0,
					total_bytes BIGINT NOT NULL DEFAULT 0,
					imported_rows BIGINT NOT NULL DEFAULT 0,
					error_message TEXT,
					created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
					started_at TIMESTAMPTZ,
					finished_at TIMESTAMPTZ,
					CONSTRAINT market_data_pack_jobs_type_check CHECK (job_type IN ('download','install','update','repair','remove')),
					CONSTRAINT market_data_pack_jobs_status_check CHECK (status IN ('queued','running','succeeded','failed','canceled'))
				);

				CREATE INDEX IF NOT EXISTS idx_market_data_pack_jobs_pack_created
					ON sigma_finance.market_data_pack_jobs(pack_id, created_at DESC);
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Repair market data pack tables ")
			_, err := db.ExecContext(ctx, `SELECT 1;`)
			return err
		},
	)
}
