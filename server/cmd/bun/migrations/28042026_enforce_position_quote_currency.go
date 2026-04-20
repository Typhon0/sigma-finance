package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Enforce positions.quote_currency non-null after validation ")
			_, err := db.ExecContext(ctx, `
				-- Normalize any existing values first.
				UPDATE sigma_finance.positions
				SET quote_currency = UPPER(quote_currency)
				WHERE quote_currency IS NOT NULL;

				-- Validation gate: do not silently coerce unresolved rows.
				DO $$
				DECLARE unresolved_count INTEGER;
				DECLARE unresolved_samples TEXT;
				BEGIN
					SELECT COUNT(*) INTO unresolved_count
					FROM sigma_finance.positions
					WHERE quote_currency IS NULL
					   OR quote_currency NOT IN ('USD', 'EUR', 'GBP');

					SELECT COALESCE(
						string_agg(
							'position_id=' || id::text || ',portfolio_id=' || portfolio_id::text || ',asset_id=' || asset_id::text || ',quote_currency=' || COALESCE(quote_currency, 'NULL'),
							' | '
						),
						''
					) INTO unresolved_samples
					FROM (
						SELECT id, portfolio_id, asset_id, quote_currency
						FROM sigma_finance.positions
						WHERE quote_currency IS NULL
						   OR quote_currency NOT IN ('USD', 'EUR', 'GBP')
						ORDER BY id
						LIMIT 25
					) samples;

					IF unresolved_count > 0 THEN
						RAISE EXCEPTION 'Cannot enforce positions.quote_currency NOT NULL; unresolved rows: %, samples: %', unresolved_count, unresolved_samples;
					END IF;
				END $$;

				ALTER TABLE sigma_finance.positions
					DROP CONSTRAINT IF EXISTS positions_quote_currency_check;
				ALTER TABLE sigma_finance.positions
					ADD CONSTRAINT positions_quote_currency_check
					CHECK (quote_currency IN ('USD', 'EUR', 'GBP'));

				ALTER TABLE sigma_finance.positions
					ALTER COLUMN quote_currency SET NOT NULL;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Relax positions.quote_currency non-null constraint ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.positions
					ALTER COLUMN quote_currency DROP NOT NULL;
				ALTER TABLE sigma_finance.positions
					DROP CONSTRAINT IF EXISTS positions_quote_currency_check;
			`)
			return err
		},
	)
}
