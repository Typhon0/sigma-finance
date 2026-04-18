package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add is_system field to market_data_credential ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.market_data_credential 
				ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;
				
				ALTER TABLE sigma_finance.market_data_credential 
				ALTER COLUMN user_id DROP NOT NULL;
				
				CREATE INDEX IF NOT EXISTS idx_market_data_credential_is_system 
				ON sigma_finance.market_data_credential(is_system) 
				WHERE is_system = true;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Remove is_system field from market_data_credential ")
			_, err := db.ExecContext(ctx, `
				DROP INDEX IF EXISTS sigma_finance.idx_market_data_credential_is_system;
				ALTER TABLE sigma_finance.market_data_credential 
				ALTER COLUMN user_id SET NOT NULL;
				ALTER TABLE sigma_finance.market_data_credential 
				DROP COLUMN IF EXISTS is_system;
			`)
			return err
		},
	)
}
