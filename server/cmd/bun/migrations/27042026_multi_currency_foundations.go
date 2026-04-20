package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Multi-currency foundations ")
			_, err := db.ExecContext(ctx, `
				-- 1) User display currency preference
				ALTER TABLE sigma_finance."user"
					ADD COLUMN IF NOT EXISTS display_currency VARCHAR(3);

				UPDATE sigma_finance."user"
				SET display_currency = 'USD'
				WHERE display_currency IS NULL;

				ALTER TABLE sigma_finance."user"
					ALTER COLUMN display_currency SET DEFAULT 'USD';
				ALTER TABLE sigma_finance."user"
					ALTER COLUMN display_currency SET NOT NULL;

				ALTER TABLE sigma_finance."user"
					DROP CONSTRAINT IF EXISTS user_display_currency_check;
				ALTER TABLE sigma_finance."user"
					ADD CONSTRAINT user_display_currency_check
					CHECK (display_currency IN ('USD', 'EUR', 'GBP'));

				-- 2) Holding quote currency (nullable-first strategy)
				ALTER TABLE sigma_finance.positions
					ADD COLUMN IF NOT EXISTS quote_currency VARCHAR(3);

				ALTER TABLE sigma_finance.portfolio_asset
					ADD COLUMN IF NOT EXISTS quote_currency VARCHAR(3);

				-- Backfill portfolio holdings from linked instrument metadata
				UPDATE sigma_finance.portfolio_asset pa
				SET quote_currency = UPPER(COALESCE(NULLIF(i.quote_currency, ''), NULLIF(i.currency, '')))
				FROM sigma_finance.assets a
				JOIN sigma_finance.instruments i ON i.id = a.instrument_id
				WHERE pa.asset_id = a.id
				  AND pa.quote_currency IS NULL
				  AND UPPER(COALESCE(NULLIF(i.quote_currency, ''), NULLIF(i.currency, ''))) IN ('USD', 'EUR', 'GBP');

				-- Backfill positions from instrument metadata first
				UPDATE sigma_finance.positions p
				SET quote_currency = UPPER(COALESCE(NULLIF(i.quote_currency, ''), NULLIF(i.currency, '')))
				FROM sigma_finance.assets a
				JOIN sigma_finance.instruments i ON i.id = a.instrument_id
				WHERE p.asset_id = a.id
				  AND p.quote_currency IS NULL
				  AND UPPER(COALESCE(NULLIF(i.quote_currency, ''), NULLIF(i.currency, ''))) IN ('USD', 'EUR', 'GBP');

				-- Then from portfolio holding snapshot
				UPDATE sigma_finance.positions p
				SET quote_currency = UPPER(pa.quote_currency)
				FROM sigma_finance.portfolio_asset pa
				WHERE p.portfolio_id = pa.portfolio_id
				  AND p.asset_id = pa.asset_id
				  AND p.quote_currency IS NULL
				  AND UPPER(pa.quote_currency) IN ('USD', 'EUR', 'GBP');

				-- Finally from asset metadata currency (manual/non-instrument assets)
				UPDATE sigma_finance.positions p
				SET quote_currency = UPPER(a.metadata ->> 'currency')
				FROM sigma_finance.assets a
				WHERE p.asset_id = a.id
				  AND p.quote_currency IS NULL
				  AND UPPER(a.metadata ->> 'currency') IN ('USD', 'EUR', 'GBP');

				-- Keep unresolved/unsupported rows NULL for validation gate migration
				UPDATE sigma_finance.positions
				SET quote_currency = NULL
				WHERE quote_currency IS NOT NULL
				  AND UPPER(quote_currency) NOT IN ('USD', 'EUR', 'GBP');

				-- 3) Transactions: hard rename to currency-aware fields
				DO $$
				BEGIN
					IF EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance' AND table_name = 'transactions' AND column_name = 'price_per_unit'
					) AND NOT EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance' AND table_name = 'transactions' AND column_name = 'unit_price_amount'
					) THEN
						ALTER TABLE sigma_finance.transactions RENAME COLUMN price_per_unit TO unit_price_amount;
					END IF;

					IF EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance' AND table_name = 'transactions' AND column_name = 'fee'
					) AND NOT EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance' AND table_name = 'transactions' AND column_name = 'fees_amount'
					) THEN
						ALTER TABLE sigma_finance.transactions RENAME COLUMN fee TO fees_amount;
					END IF;

					IF EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance' AND table_name = 'transactions' AND column_name = 'transaction_date'
					) AND NOT EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance' AND table_name = 'transactions' AND column_name = 'executed_at'
					) THEN
						ALTER TABLE sigma_finance.transactions RENAME COLUMN transaction_date TO executed_at;
					END IF;
				END $$;

				ALTER TABLE sigma_finance.transactions
					ADD COLUMN IF NOT EXISTS unit_price_currency VARCHAR(3),
					ADD COLUMN IF NOT EXISTS fees_currency VARCHAR(3),
					ADD COLUMN IF NOT EXISTS fees_amount BIGINT;

				UPDATE sigma_finance.transactions t
				SET unit_price_currency = COALESCE(t.unit_price_currency, p.quote_currency, 'USD')
				FROM sigma_finance.positions p
				WHERE t.position_id = p.id
				  AND t.unit_price_currency IS NULL;

				UPDATE sigma_finance.transactions
				SET unit_price_currency = 'USD'
				WHERE unit_price_currency IS NULL;

				UPDATE sigma_finance.transactions
				SET fees_currency = COALESCE(fees_currency, unit_price_currency, 'USD')
				WHERE fees_currency IS NULL;

				UPDATE sigma_finance.transactions
				SET fees_amount = 0
				WHERE fees_amount IS NULL;

				ALTER TABLE sigma_finance.transactions
					ALTER COLUMN unit_price_currency SET DEFAULT 'USD',
					ALTER COLUMN unit_price_currency SET NOT NULL,
					ALTER COLUMN fees_currency SET DEFAULT 'USD',
					ALTER COLUMN fees_currency SET NOT NULL,
					ALTER COLUMN fees_amount SET DEFAULT 0,
					ALTER COLUMN fees_amount SET NOT NULL;

				ALTER TABLE sigma_finance.transactions
					DROP CONSTRAINT IF EXISTS transactions_unit_price_currency_check;
				ALTER TABLE sigma_finance.transactions
					ADD CONSTRAINT transactions_unit_price_currency_check
					CHECK (unit_price_currency IN ('USD', 'EUR', 'GBP'));

				ALTER TABLE sigma_finance.transactions
					DROP CONSTRAINT IF EXISTS transactions_fees_currency_check;
				ALTER TABLE sigma_finance.transactions
					ADD CONSTRAINT transactions_fees_currency_check
					CHECK (fees_currency IN ('USD', 'EUR', 'GBP'));

				ALTER TABLE sigma_finance.transactions
					ALTER COLUMN executed_at SET NOT NULL;

				DROP INDEX IF EXISTS sigma_finance.idx_transactions_date;
				CREATE INDEX IF NOT EXISTS idx_transactions_executed_at
					ON sigma_finance.transactions(executed_at);

				-- 4) FX table provenance guarantees
				ALTER TABLE sigma_finance.fx_rates
					ADD COLUMN IF NOT EXISTS source VARCHAR(50),
					ADD COLUMN IF NOT EXISTS as_of TIMESTAMP,
					ADD COLUMN IF NOT EXISTS granularity VARCHAR(20),
					ADD COLUMN IF NOT EXISTS is_stale BOOLEAN;

				UPDATE sigma_finance.fx_rates
				SET source = COALESCE(source, 'UNKNOWN'),
					as_of = COALESCE(as_of, created_at, NOW()),
					granularity = COALESCE(granularity, 'MINUTE'),
					is_stale = COALESCE(is_stale, FALSE)
				WHERE source IS NULL OR as_of IS NULL OR granularity IS NULL OR is_stale IS NULL;

				ALTER TABLE sigma_finance.fx_rates
					ALTER COLUMN source SET NOT NULL,
					ALTER COLUMN as_of SET NOT NULL,
					ALTER COLUMN granularity SET NOT NULL,
					ALTER COLUMN is_stale SET DEFAULT FALSE,
					ALTER COLUMN is_stale SET NOT NULL;

				CREATE INDEX IF NOT EXISTS idx_fx_rates_pair_as_of
					ON sigma_finance.fx_rates(base_currency, quote_currency, as_of DESC);
				CREATE INDEX IF NOT EXISTS idx_fx_rates_pair_granularity_as_of
					ON sigma_finance.fx_rates(base_currency, quote_currency, granularity, as_of DESC);
				CREATE INDEX IF NOT EXISTS idx_fx_rates_granularity
					ON sigma_finance.fx_rates(granularity);
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Multi-currency foundations ")
			_, err := db.ExecContext(ctx, `
				-- Down keeps data-safe stance; only removes newly-added constraints/indexes/defaults.
				ALTER TABLE sigma_finance."user" DROP CONSTRAINT IF EXISTS user_display_currency_check;
				ALTER TABLE sigma_finance.transactions DROP CONSTRAINT IF EXISTS transactions_unit_price_currency_check;
				ALTER TABLE sigma_finance.transactions DROP CONSTRAINT IF EXISTS transactions_fees_currency_check;
				DROP INDEX IF EXISTS sigma_finance.idx_transactions_executed_at;
				DROP INDEX IF EXISTS sigma_finance.idx_fx_rates_pair_as_of;
				DROP INDEX IF EXISTS sigma_finance.idx_fx_rates_pair_granularity_as_of;
				DROP INDEX IF EXISTS sigma_finance.idx_fx_rates_granularity;
			`)
			return err
		},
	)
}
