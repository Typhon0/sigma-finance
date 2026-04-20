package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Ensure quote currency columns for holdings and positions ")

			// Idempotent reconciliation for environments where multi-currency
			// migrations were tracked but tables/columns were not yet present.
			_, err := db.ExecContext(ctx, `
				DO $$
				BEGIN
					-- 1) Ensure portfolio_asset.quote_currency exists
					IF NOT EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance'
						  AND table_name = 'portfolio_asset'
						  AND column_name = 'quote_currency'
					) THEN
						ALTER TABLE sigma_finance.portfolio_asset
							ADD COLUMN quote_currency VARCHAR(3);
					END IF;

					-- 2) Ensure positions.quote_currency exists
					IF NOT EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_schema = 'sigma_finance'
						  AND table_name = 'positions'
						  AND column_name = 'quote_currency'
					) THEN
						ALTER TABLE sigma_finance.positions
							ADD COLUMN quote_currency VARCHAR(3);
					END IF;
				END $$;
			`)
			if err != nil {
				return err
			}

			// 3) Backfill portfolio_asset quote currency from instrument or metadata
			_, err = db.ExecContext(ctx, `
				UPDATE sigma_finance.portfolio_asset pa
				SET quote_currency = UPPER(COALESCE(NULLIF(i.quote_currency, ''), NULLIF(i.currency, ''), a.metadata ->> 'currency'))
				FROM sigma_finance.assets a
				LEFT JOIN sigma_finance.instruments i ON i.id = a.instrument_id
				WHERE pa.asset_id = a.id
				  AND pa.quote_currency IS NULL
				  AND UPPER(COALESCE(NULLIF(i.quote_currency, ''), NULLIF(i.currency, ''), a.metadata ->> 'currency')) IN ('USD', 'EUR', 'GBP');
			`)
			if err != nil {
				return err
			}

			// 4) Backfill positions quote currency from portfolio_asset, instrument or metadata
			_, err = db.ExecContext(ctx, `
				UPDATE sigma_finance.positions p
				SET quote_currency = UPPER(COALESCE(
					NULLIF(pa.quote_currency, ''),
					NULLIF(i.quote_currency, ''),
					NULLIF(i.currency, ''),
					a.metadata ->> 'currency'
				))
				FROM sigma_finance.assets a
				LEFT JOIN sigma_finance.portfolio_asset pa ON pa.asset_id = a.id
				LEFT JOIN sigma_finance.instruments i ON i.id = a.instrument_id
				WHERE p.asset_id = a.id
				  AND (pa.portfolio_id = p.portfolio_id OR pa.portfolio_id IS NULL)
				  AND p.quote_currency IS NULL
				  AND UPPER(COALESCE(
					NULLIF(pa.quote_currency, ''),
					NULLIF(i.quote_currency, ''),
					NULLIF(i.currency, ''),
					a.metadata ->> 'currency'
				  )) IN ('USD', 'EUR', 'GBP');
			`)
			if err != nil {
				return err
			}

			// 5) Keep only supported currencies
			_, err = db.ExecContext(ctx, `
				UPDATE sigma_finance.portfolio_asset
				SET quote_currency = NULL
				WHERE quote_currency IS NOT NULL
				  AND UPPER(quote_currency) NOT IN ('USD', 'EUR', 'GBP');

				UPDATE sigma_finance.positions
				SET quote_currency = NULL
				WHERE quote_currency IS NOT NULL
				  AND UPPER(quote_currency) NOT IN ('USD', 'EUR', 'GBP');
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			// no-op down: column removal would break current code paths
			fmt.Print(" [down migration] Ensure quote currency columns for holdings and positions (no-op) ")
			return nil
		},
	)
}
