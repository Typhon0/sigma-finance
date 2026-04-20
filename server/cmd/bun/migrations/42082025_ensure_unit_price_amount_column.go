package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Ensure currency-aware transaction columns ")

			// This migration is idempotent. It handles the case where the
			// multi-currency foundations migration (27042026) was tracked as
			// complete but the column renames did not actually execute
			// (e.g. the table did not exist yet when the migration ran).
			_, err := db.ExecContext(ctx, `
				DO $$
				BEGIN
					-- 1) price_per_unit → unit_price_amount
					IF EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance'
						  AND table_name = 'transactions'
						  AND column_name = 'price_per_unit'
					) AND NOT EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance'
						  AND table_name = 'transactions'
						  AND column_name = 'unit_price_amount'
					) THEN
						ALTER TABLE sigma_finance.transactions
							RENAME COLUMN price_per_unit TO unit_price_amount;
					END IF;

					IF NOT EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance'
						  AND table_name = 'transactions'
						  AND column_name = 'unit_price_amount'
					) THEN
						ALTER TABLE sigma_finance.transactions
							ADD COLUMN unit_price_amount DECIMAL(20,8);
					END IF;

					-- 2) transaction_date → executed_at
					IF EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance'
						  AND table_name = 'transactions'
						  AND column_name = 'transaction_date'
					) AND NOT EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance'
						  AND table_name = 'transactions'
						  AND column_name = 'executed_at'
					) THEN
						ALTER TABLE sigma_finance.transactions
							RENAME COLUMN transaction_date TO executed_at;
					END IF;

					IF NOT EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance'
						  AND table_name = 'transactions'
						  AND column_name = 'executed_at'
					) THEN
						ALTER TABLE sigma_finance.transactions
							ADD COLUMN executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
					END IF;

					-- 3) fee → fees_amount
					IF EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance'
						  AND table_name = 'transactions'
						  AND column_name = 'fee'
					) AND NOT EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance'
						  AND table_name = 'transactions'
						  AND column_name = 'fees_amount'
					) THEN
						ALTER TABLE sigma_finance.transactions
							RENAME COLUMN fee TO fees_amount;
					END IF;

					IF NOT EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance'
						  AND table_name = 'transactions'
						  AND column_name = 'fees_amount'
					) THEN
						ALTER TABLE sigma_finance.transactions
							ADD COLUMN fees_amount BIGINT DEFAULT 0;
					END IF;

					-- 4) Add currency columns if missing
					IF NOT EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance'
						  AND table_name = 'transactions'
						  AND column_name = 'unit_price_currency'
					) THEN
						ALTER TABLE sigma_finance.transactions
							ADD COLUMN unit_price_currency VARCHAR(3) NOT NULL DEFAULT 'USD';
					END IF;

					IF NOT EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance'
						  AND table_name = 'transactions'
						  AND column_name = 'fees_currency'
					) THEN
						ALTER TABLE sigma_finance.transactions
							ADD COLUMN fees_currency VARCHAR(3) NOT NULL DEFAULT 'USD';
					END IF;
				END $$;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			// Down: no-op (the columns are required by the Go model;
			// renaming them back would break the running application).
			fmt.Print(" [down migration] Ensure currency-aware transaction columns (no-op) ")
			return nil
		},
	)
}
