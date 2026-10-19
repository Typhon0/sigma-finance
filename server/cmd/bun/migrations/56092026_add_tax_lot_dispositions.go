package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Create tax_lot_dispositions table and positions.realized_gain_loss column ")

			// tax_lot_dispositions records one row per lot-matched disposal
			// (fiscal FIFO gain/loss). This is deliberately a SEPARATE number
			// from the economic P/L on positions: fiscal G/L is what tax
			// authorities assess (lot-matched, per-disposal), economic P/L is
			// what the position actually earned (average-cost, cumulative).
			// Collapsing them hides either the tax bill or the performance.
			_, err := db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.tax_lot_dispositions (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					lot_id UUID NOT NULL REFERENCES sigma_finance.tax_lots(id) ON DELETE CASCADE,
					position_id UUID NOT NULL REFERENCES sigma_finance.positions(id) ON DELETE CASCADE,
					portfolio_id UUID NOT NULL REFERENCES sigma_finance.portfolio(id) ON DELETE CASCADE,
					asset_id UUID NOT NULL REFERENCES sigma_finance.assets(id) ON DELETE CASCADE,
					transaction_id UUID REFERENCES sigma_finance.transactions(id) ON DELETE SET NULL,
					acquired_at TIMESTAMPTZ NOT NULL,
					sold_at TIMESTAMPTZ NOT NULL,
					quantity DECIMAL(20,8) NOT NULL,
					cost_basis_per_unit DECIMAL(20,8) NOT NULL,
					sell_price_per_unit DECIMAL(20,8) NOT NULL,
					cost_basis BIGINT NOT NULL,
					proceeds BIGINT NOT NULL,
					realized_gain_loss BIGINT NOT NULL,
					method VARCHAR(20) NOT NULL DEFAULT 'FIFO',
					holding_period_days INT NOT NULL DEFAULT 0,
					is_long_term BOOLEAN NOT NULL DEFAULT FALSE,
					created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
				);

				CREATE INDEX IF NOT EXISTS idx_tax_lot_dispositions_position
					ON sigma_finance.tax_lot_dispositions(position_id, sold_at);
				CREATE INDEX IF NOT EXISTS idx_tax_lot_dispositions_portfolio
					ON sigma_finance.tax_lot_dispositions(portfolio_id, sold_at);

				ALTER TABLE sigma_finance.positions
					ADD COLUMN IF NOT EXISTS realized_gain_loss BIGINT NOT NULL DEFAULT 0;

				COMMENT ON TABLE sigma_finance.tax_lot_dispositions IS
					'Fiscal (lot-matched) realized gain/loss per disposal. Economic cumulative P/L lives on positions.realized_gain_loss.';
				COMMENT ON COLUMN sigma_finance.tax_lot_dispositions.realized_gain_loss IS
					'Lot-matched fiscal gain/loss in cents (proceeds - cost basis). Distinct from economic P/L.';
				COMMENT ON COLUMN sigma_finance.positions.realized_gain_loss IS
					'Cumulative economic realized P/L in cents (average-cost method). Distinct from fiscal lot-matched G/L in tax_lot_dispositions.';
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Drop tax_lot_dispositions table and positions.realized_gain_loss ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.positions DROP COLUMN IF EXISTS realized_gain_loss;
				DROP TABLE IF EXISTS sigma_finance.tax_lot_dispositions CASCADE;
			`)
			return err
		},
	)
}
