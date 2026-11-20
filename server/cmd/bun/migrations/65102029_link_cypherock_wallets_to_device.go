package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Link Cypherock wallet accounts to Cypherock hardware device ")

			_, err := db.ExecContext(ctx, `
				-- Fix typo in device name if present
				UPDATE sigma_finance.wallet_devices
				SET name = 'Cypherock'
				WHERE name = 'Cypherocck';

				-- Link Cypherock BTC and Cypherock solana to the Cypherock hardware device
				UPDATE sigma_finance.wallet_accounts
				SET device_id = (
					SELECT id FROM sigma_finance.wallet_devices 
					WHERE name = 'Cypherock' AND device_type = 'HARDWARE' 
					ORDER BY created_at ASC LIMIT 1
				)
				WHERE label ILIKE 'Cypherock%' AND device_id IS NULL;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Unlink Cypherock wallet accounts from device ")
			_, err := db.ExecContext(ctx, `
				UPDATE sigma_finance.wallet_accounts
				SET device_id = NULL
				WHERE label ILIKE 'Cypherock%';
			`)
			return err
		},
	)
}
