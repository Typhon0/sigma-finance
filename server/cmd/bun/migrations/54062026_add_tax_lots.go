package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Create tax_lots table for institutional tax-lot accounting ")
			_, err := db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.tax_lots (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					portfolio_id UUID NOT NULL REFERENCES sigma_finance.portfolio(id) ON DELETE CASCADE,
					position_id UUID NOT NULL REFERENCES sigma_finance.positions(id) ON DELETE CASCADE,
					asset_id UUID NOT NULL REFERENCES sigma_finance.assets(id) ON DELETE CASCADE,
					transaction_id UUID REFERENCES sigma_finance.transactions(id) ON DELETE SET NULL,
					acquired_at TIMESTAMPTZ NOT NULL,
					initial_quantity DECIMAL(20,8) NOT NULL,
					remaining_quantity DECIMAL(20,8) NOT NULL,
					cost_basis_per_unit DECIMAL(20,8) NOT NULL,
					total_cost_basis BIGINT NOT NULL,
					currency VARCHAR(10) NOT NULL DEFAULT 'USD',
					status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
					created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
					updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
				);

				CREATE INDEX IF NOT EXISTS idx_tax_lots_position_status ON sigma_finance.tax_lots(position_id, status);
				CREATE INDEX IF NOT EXISTS idx_tax_lots_portfolio_id ON sigma_finance.tax_lots(portfolio_id);
				CREATE INDEX IF NOT EXISTS idx_tax_lots_asset_id ON sigma_finance.tax_lots(asset_id);
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Drop tax_lots table ")
			_, err := db.ExecContext(ctx, `
				DROP TABLE IF EXISTS sigma_finance.tax_lots CASCADE;
			`)
			return err
		},
	)
}
