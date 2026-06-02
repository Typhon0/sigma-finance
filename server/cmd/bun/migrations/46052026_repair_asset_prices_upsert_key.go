package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Repair asset_prices upsert key ")
			_, err := db.ExecContext(ctx, `
				WITH ranked AS (
					SELECT
						id,
						ROW_NUMBER() OVER (
							PARTITION BY asset_id, timestamp
							ORDER BY id DESC
						) AS rn
					FROM sigma_finance.asset_prices
				)
				DELETE FROM sigma_finance.asset_prices p
				USING ranked r
				WHERE p.id = r.id
					AND r.rn > 1;

				CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_prices_asset_id_timestamp_unique
					ON sigma_finance.asset_prices(asset_id, timestamp);
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Repair asset_prices upsert key ")
			_, err := db.ExecContext(ctx, `
				DROP INDEX IF EXISTS sigma_finance.idx_asset_prices_asset_id_timestamp_unique;
			`)
			return err
		},
	)
}
