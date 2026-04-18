package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add instrument owner user id ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.instruments
					ADD COLUMN IF NOT EXISTS owner_user_id UUID;

				UPDATE sigma_finance.instruments AS instrument
				SET owner_user_id = owner_map.owner_user_id
				FROM (
					SELECT
						discovery.persisted_instrument_id AS instrument_id,
						MAX(discovery.user_id) AS owner_user_id
					FROM sigma_finance.discovery_logs AS discovery
					WHERE discovery.persisted_instrument_id IS NOT NULL
						AND discovery.user_id IS NOT NULL
					GROUP BY discovery.persisted_instrument_id
					HAVING COUNT(DISTINCT discovery.user_id) = 1
				) AS owner_map
				WHERE instrument.id = owner_map.instrument_id
					AND instrument.provider_source = 'manual'
					AND instrument.owner_user_id IS NULL;

				CREATE INDEX IF NOT EXISTS instruments_manual_owner_user_idx
					ON sigma_finance.instruments(owner_user_id)
					WHERE provider_source = 'manual';
			`)
			if err != nil {
				fmt.Printf(" (failed - %v) ", err)
				return err
			}
			fmt.Print(" (ok) ")
			return nil
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] ")
			_, err := db.ExecContext(ctx, `
				DROP INDEX IF EXISTS sigma_finance.instruments_manual_owner_user_idx;
				ALTER TABLE sigma_finance.instruments
					DROP COLUMN IF EXISTS owner_user_id;
			`)
			if err != nil {
				fmt.Printf(" (failed - %v) ", err)
				return err
			}
			fmt.Print(" (ok) ")
			return nil
		},
	)
}
