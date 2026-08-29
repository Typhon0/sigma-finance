package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add pack_instrument_id column to market_data_pack_coverage ")
			// Use a DO block to check column existence before ALTER TABLE.
			// This avoids acquiring an exclusive lock when the column already exists.
			_, err := db.ExecContext(ctx, `
				DO $$
				BEGIN
					IF NOT EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance'
						  AND table_name   = 'market_data_pack_coverage'
						  AND column_name  = 'pack_instrument_id'
					) THEN
						ALTER TABLE sigma_finance.market_data_pack_coverage
						ADD COLUMN pack_instrument_id UUID;
					END IF;
				END $$;

				COMMENT ON COLUMN sigma_finance.market_data_pack_coverage.pack_instrument_id
				IS 'Original pack-generated instrument ID. Set when instrument_id has been bridged to a DB instrument ID. Used by PackCandleStore to filter parquet rows by the pack-native ID.';
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Remove pack_instrument_id column from market_data_pack_coverage ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.market_data_pack_coverage
				DROP COLUMN IF EXISTS pack_instrument_id;
			`)
			return err
		},
	)
}
