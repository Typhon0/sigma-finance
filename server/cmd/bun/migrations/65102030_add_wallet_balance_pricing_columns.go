package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add wallet balance pricing columns and migrate RNDR to RENDER ")

			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.wallet_balances
				ADD COLUMN IF NOT EXISTS current_price numeric(36, 18),
				ADD COLUMN IF NOT EXISTS day_change_24h numeric(10, 4),
				ADD COLUMN IF NOT EXISTS price_updated_at timestamp with time zone,
				ADD COLUMN IF NOT EXISTS price_source character varying(50);

				-- Update RNDR on Solana to RENDER
				UPDATE sigma_finance.wallet_balances
				SET symbol = 'RENDER',
				    name = 'Render'
				WHERE token_address = 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof';

				-- Update instrument and mapping for Render token on Solana
				UPDATE sigma_finance.instruments
				SET symbol = 'RENDER',
				    name = 'Render'
				WHERE provider_external_id = 'solana:rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof';

				UPDATE sigma_finance.instrument_provider_mappings
				SET provider_asset_id = 'RENDERUSDT',
				    provider_symbol = 'RENDERUSDT'
				WHERE provider = 'BINANCE'
				  AND instrument_id = 'a102091b-878f-48b6-ab8c-5cad267c5450';
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Remove wallet balance pricing columns ")

			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.wallet_balances
				DROP COLUMN IF EXISTS current_price,
				DROP COLUMN IF EXISTS day_change_24h,
				DROP COLUMN IF EXISTS price_updated_at,
				DROP COLUMN IF EXISTS price_source;
			`)
			return err
		},
	)
}
