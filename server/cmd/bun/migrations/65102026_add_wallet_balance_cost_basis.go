package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add cost basis tracking to wallet_balances ")

			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.wallet_balances
				ADD COLUMN IF NOT EXISTS cost_basis_per_unit NUMERIC(36, 18),
				ADD COLUMN IF NOT EXISTS cost_basis_currency VARCHAR(10) DEFAULT 'USD',
				ADD COLUMN IF NOT EXISTS cost_basis_type VARCHAR(30) DEFAULT 'UNRECORDED',
				ADD COLUMN IF NOT EXISTS auto_estimated_basis NUMERIC(36, 18),
				ADD COLUMN IF NOT EXISTS acquired_at TIMESTAMP WITH TIME ZONE;

				CREATE INDEX IF NOT EXISTS idx_wallet_balances_account_symbol
				ON sigma_finance.wallet_balances(wallet_account_id, symbol);
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Drop cost basis tracking from wallet_balances ")

			_, err := db.ExecContext(ctx, `
				DROP INDEX IF EXISTS sigma_finance.idx_wallet_balances_account_symbol;

				ALTER TABLE sigma_finance.wallet_balances
				DROP COLUMN IF EXISTS cost_basis_per_unit,
				DROP COLUMN IF EXISTS cost_basis_currency,
				DROP COLUMN IF EXISTS cost_basis_type,
				DROP COLUMN IF EXISTS auto_estimated_basis,
				DROP COLUMN IF EXISTS acquired_at;
			`)
			return err
		},
	)
}
