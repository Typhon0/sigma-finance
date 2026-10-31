package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Widen quantity and cost basis precision across positions, transactions, and tax_lots ")

			_, err := db.ExecContext(ctx, `
				-- Widen positions quantity and cost basis to arbitrary precision NUMERIC
				ALTER TABLE sigma_finance.positions
					ALTER COLUMN quantity TYPE NUMERIC,
					ALTER COLUMN average_cost_basis TYPE NUMERIC;

				-- Widen transactions quantity and unit price amount to arbitrary precision NUMERIC
				ALTER TABLE sigma_finance.transactions
					ALTER COLUMN quantity TYPE NUMERIC,
					ALTER COLUMN unit_price_amount TYPE NUMERIC;

				-- Widen tax_lots quantity and cost basis to arbitrary precision NUMERIC
				ALTER TABLE sigma_finance.tax_lots
					ALTER COLUMN initial_quantity TYPE NUMERIC,
					ALTER COLUMN remaining_quantity TYPE NUMERIC,
					ALTER COLUMN cost_basis_per_unit TYPE NUMERIC;

				-- Widen tax_lot_dispositions quantity and cost basis to arbitrary precision NUMERIC
				ALTER TABLE sigma_finance.tax_lot_dispositions
					ALTER COLUMN quantity TYPE NUMERIC,
					ALTER COLUMN cost_basis_per_unit TYPE NUMERIC,
					ALTER COLUMN sell_price_per_unit TYPE NUMERIC;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Revert quantity and cost basis precision ")

			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.positions
					ALTER COLUMN quantity TYPE DECIMAL(20,8),
					ALTER COLUMN average_cost_basis TYPE DECIMAL(20,8);

				ALTER TABLE sigma_finance.transactions
					ALTER COLUMN quantity TYPE DECIMAL(20,8),
					ALTER COLUMN unit_price_amount TYPE DECIMAL(20,8);

				ALTER TABLE sigma_finance.tax_lots
					ALTER COLUMN initial_quantity TYPE DECIMAL(20,8),
					ALTER COLUMN remaining_quantity TYPE DECIMAL(20,8),
					ALTER COLUMN cost_basis_per_unit TYPE DECIMAL(20,8);

				ALTER TABLE sigma_finance.tax_lot_dispositions
					ALTER COLUMN quantity TYPE DECIMAL(20,8),
					ALTER COLUMN cost_basis_per_unit TYPE DECIMAL(20,8),
					ALTER COLUMN sell_price_per_unit TYPE DECIMAL(20,8);
			`)
			return err
		},
	)
}

