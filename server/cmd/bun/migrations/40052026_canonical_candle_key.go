package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Canonical candle key without source ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.candle
					ADD COLUMN IF NOT EXISTS instrument_id UUID,
					ADD COLUMN IF NOT EXISTS quote_currency TEXT,
					ADD COLUMN IF NOT EXISTS source TEXT;

				UPDATE sigma_finance.candle
				SET quote_currency = COALESCE(NULLIF(quote_currency, ''), 'USD'),
					source = COALESCE(NULLIF(source, ''), 'UNKNOWN');

				ALTER TABLE sigma_finance.candle
					ALTER COLUMN quote_currency SET NOT NULL,
					ALTER COLUMN source SET NOT NULL;

				WITH ranked AS (
					SELECT
						c.ctid,
						ROW_NUMBER() OVER (
							PARTITION BY c.instrument_id, c.interval, c.timestamp, c.quote_currency
							ORDER BY
								CASE
									WHEN UPPER(c.asset_type) IN ('STOCK', 'ETF', 'FUND') THEN
										CASE UPPER(c.source)
											WHEN 'TIINGO' THEN 1
											WHEN 'ALPHAVANTAGE' THEN 2
											WHEN 'TWELVEDATA' THEN 3
											WHEN 'FINNHUB' THEN 4
											WHEN 'YFINANCE' THEN 5
											WHEN 'BOOTSTRAP-PACK' THEN 90
											ELSE 50
										END
									WHEN UPPER(c.asset_type) = 'CRYPTO' THEN
										CASE UPPER(c.source)
											WHEN 'BINANCE' THEN 1
											WHEN 'CRYPTOCOMPARE' THEN 2
											WHEN 'TIINGO' THEN 3
											WHEN 'YFINANCE' THEN 4
											WHEN 'BOOTSTRAP-PACK' THEN 90
											ELSE 50
										END
									WHEN UPPER(c.asset_type) = 'FOREX' THEN
										CASE UPPER(c.source)
											WHEN 'ALPHAVANTAGE' THEN 1
											WHEN 'TIINGO' THEN 2
											WHEN 'TWELVEDATA' THEN 3
											WHEN 'BOOTSTRAP-PACK' THEN 90
											ELSE 50
										END
									ELSE
										CASE UPPER(c.source)
											WHEN 'BOOTSTRAP-PACK' THEN 90
											ELSE 50
										END
								END ASC,
								c.timestamp DESC,
								c.ctid DESC
						) AS rn
					FROM sigma_finance.candle c
					WHERE c.instrument_id IS NOT NULL
				)
				DELETE FROM sigma_finance.candle c
				USING ranked r
				WHERE c.ctid = r.ctid
				  AND r.rn > 1;

				DROP INDEX IF EXISTS sigma_finance.idx_candle_instrument_interval_time_quote_source;

				CREATE UNIQUE INDEX IF NOT EXISTS idx_candle_instrument_interval_time_quote_unique
					ON sigma_finance.candle(instrument_id, interval, timestamp, quote_currency);

				CREATE INDEX IF NOT EXISTS idx_candle_instrument_interval_time_quote
					ON sigma_finance.candle(instrument_id, interval, timestamp, quote_currency);
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Canonical candle key without source ")
			_, err := db.ExecContext(ctx, `
				DROP INDEX IF EXISTS sigma_finance.idx_candle_instrument_interval_time_quote_unique;
			`)
			return err
		},
	)
}
