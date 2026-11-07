package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add asset_prices_daily rollup ")
			_, err := db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_daily (
					asset_id uuid NOT NULL REFERENCES sigma_finance.assets(id) ON DELETE CASCADE,
					price_date date NOT NULL,
					price numeric(20,8) NOT NULL,
					source varchar(100) NOT NULL,
					price_timestamp timestamptz NOT NULL,
					updated_at timestamptz NOT NULL DEFAULT now(),
					PRIMARY KEY (asset_id, price_date)
				);

				ALTER TABLE sigma_finance.asset_prices_daily
					ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

				CREATE INDEX IF NOT EXISTS idx_asset_prices_daily_date
					ON sigma_finance.asset_prices_daily (price_date);

				-- Backfill before installing the trigger so the initial copy does
				-- not pay the per-row trigger cost.
				INSERT INTO sigma_finance.asset_prices_daily (
					asset_id, price_date, price, source, price_timestamp, updated_at
				)
				SELECT DISTINCT ON (ap.asset_id, ap.timestamp::date)
					ap.asset_id,
					ap.timestamp::date,
					ap.price,
					ap.source,
					ap.timestamp,
					now()
				FROM sigma_finance.asset_prices ap
				ORDER BY ap.asset_id, ap.timestamp::date, ap.timestamp DESC
				ON CONFLICT (asset_id, price_date) DO UPDATE
				SET price = EXCLUDED.price,
					source = EXCLUDED.source,
					price_timestamp = EXCLUDED.price_timestamp,
					updated_at = now()
				WHERE EXCLUDED.price_timestamp >= sigma_finance.asset_prices_daily.price_timestamp;

				CREATE OR REPLACE FUNCTION sigma_finance.sync_asset_prices_daily()
				RETURNS trigger AS $$
				BEGIN
					INSERT INTO sigma_finance.asset_prices_daily (
						asset_id, price_date, price, source, price_timestamp, updated_at
					)
					VALUES (
						NEW.asset_id, NEW.timestamp::date, NEW.price, NEW.source, NEW.timestamp, now()
					)
					ON CONFLICT (asset_id, price_date) DO UPDATE
					SET price = EXCLUDED.price,
						source = EXCLUDED.source,
						price_timestamp = EXCLUDED.price_timestamp,
						updated_at = now()
					WHERE EXCLUDED.price_timestamp >= sigma_finance.asset_prices_daily.price_timestamp;
					RETURN NEW;
				END;
				$$ LANGUAGE plpgsql;

				DROP TRIGGER IF EXISTS trg_asset_prices_daily ON sigma_finance.asset_prices;
				CREATE TRIGGER trg_asset_prices_daily
				AFTER INSERT OR UPDATE ON sigma_finance.asset_prices
				FOR EACH ROW EXECUTE FUNCTION sigma_finance.sync_asset_prices_daily();
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Drop asset_prices_daily rollup ")
			_, err := db.ExecContext(ctx, `
				DROP TRIGGER IF EXISTS trg_asset_prices_daily ON sigma_finance.asset_prices;
				DROP FUNCTION IF EXISTS sigma_finance.sync_asset_prices_daily();
				DROP TABLE IF EXISTS sigma_finance.asset_prices_daily;
			`)
			return err
		},
	)
}
