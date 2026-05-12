package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Market data packs and decimal candles ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.candle
					ADD COLUMN IF NOT EXISTS instrument_id UUID,
					ADD COLUMN IF NOT EXISTS quote_currency TEXT DEFAULT 'USD',
					ADD COLUMN IF NOT EXISTS adjusted_close NUMERIC(38,18);

				ALTER TABLE sigma_finance.candle
					ALTER COLUMN quote_currency SET DEFAULT 'USD';

				UPDATE sigma_finance.candle
				SET quote_currency = 'USD'
				WHERE quote_currency IS NULL OR btrim(quote_currency) = '';

				ALTER TABLE sigma_finance.candle
					ALTER COLUMN open TYPE NUMERIC(38,18) USING (open::NUMERIC / 100),
					ALTER COLUMN high TYPE NUMERIC(38,18) USING (high::NUMERIC / 100),
					ALTER COLUMN low TYPE NUMERIC(38,18) USING (low::NUMERIC / 100),
					ALTER COLUMN close TYPE NUMERIC(38,18) USING (close::NUMERIC / 100),
					ALTER COLUMN volume TYPE NUMERIC(38,8) USING COALESCE(volume::NUMERIC, 0);

				ALTER TABLE sigma_finance.candle
					ALTER COLUMN volume SET DEFAULT 0,
					ALTER COLUMN volume SET NOT NULL,
					ALTER COLUMN quote_currency SET NOT NULL;

				WITH unique_instruments AS (
					SELECT normalized_symbol, asset_type::TEXT AS asset_type, MIN(id) AS instrument_id
					FROM sigma_finance.instruments
					GROUP BY normalized_symbol, asset_type::TEXT
					HAVING COUNT(*) = 1
				)
				UPDATE sigma_finance.candle c
				SET instrument_id = ui.instrument_id
				FROM unique_instruments ui
				WHERE c.instrument_id IS NULL
				  AND ui.normalized_symbol = UPPER(c.symbol)
				  AND (
						ui.asset_type = UPPER(c.asset_type)
						OR (UPPER(c.asset_type) = 'STOCK' AND ui.asset_type IN ('STOCK', 'ETF'))
						OR (UPPER(c.asset_type) = 'FUND' AND ui.asset_type IN ('FUND', 'ETF'))
				  );

				CREATE UNIQUE INDEX IF NOT EXISTS idx_candle_instrument_interval_time_quote_source
					ON sigma_finance.candle(instrument_id, interval, timestamp, quote_currency, source);
				CREATE INDEX IF NOT EXISTS idx_candle_instrument_interval_time_quote
					ON sigma_finance.candle(instrument_id, interval, timestamp, quote_currency);
				CREATE INDEX IF NOT EXISTS idx_candle_symbol_asset_interval_time
					ON sigma_finance.candle(symbol, asset_type, interval, timestamp DESC);

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

				CREATE TABLE IF NOT EXISTS sigma_finance.portfolio_daily_values (
					portfolio_id UUID NOT NULL REFERENCES sigma_finance.portfolio(id) ON DELETE CASCADE,
					date DATE NOT NULL,
					base_currency TEXT NOT NULL,
					total_value NUMERIC(38,18) NOT NULL,
					invested_amount NUMERIC(38,18) NOT NULL,
					pnl NUMERIC(38,18) NOT NULL,
					pnl_percent NUMERIC(38,18) NOT NULL,
					data_status TEXT NOT NULL,
					created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
					updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
					PRIMARY KEY (portfolio_id, date, base_currency),
					CONSTRAINT portfolio_daily_values_status_check CHECK (data_status IN ('complete','partial','stale'))
				);

				CREATE TABLE IF NOT EXISTS sigma_finance.portfolio_recalculation_jobs (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					portfolio_id UUID NOT NULL REFERENCES sigma_finance.portfolio(id) ON DELETE CASCADE,
					dirty_from_date DATE NOT NULL,
					status TEXT NOT NULL,
					error_message TEXT,
					created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
					started_at TIMESTAMPTZ,
					finished_at TIMESTAMPTZ,
					CONSTRAINT portfolio_recalculation_jobs_status_check CHECK (status IN ('queued','running','succeeded','failed','canceled'))
				);

				CREATE INDEX IF NOT EXISTS idx_portfolio_recalculation_jobs_portfolio_status
					ON sigma_finance.portfolio_recalculation_jobs(portfolio_id, status, dirty_from_date);
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Market data packs and decimal candles ")
			_, err := db.ExecContext(ctx, `
				DROP TABLE IF EXISTS sigma_finance.portfolio_recalculation_jobs;
				DROP TABLE IF EXISTS sigma_finance.portfolio_daily_values;
				DROP TABLE IF EXISTS sigma_finance.market_data_pack_jobs;
				DROP TABLE IF EXISTS sigma_finance.market_data_pack_coverage;
				DROP TABLE IF EXISTS sigma_finance.market_data_packs;
				DROP INDEX IF EXISTS sigma_finance.idx_candle_instrument_interval_time_quote;
				DROP INDEX IF EXISTS sigma_finance.idx_candle_instrument_interval_time_quote_source;
				DROP INDEX IF EXISTS sigma_finance.idx_candle_symbol_asset_interval_time;
			`)
			return err
		},
	)
}
