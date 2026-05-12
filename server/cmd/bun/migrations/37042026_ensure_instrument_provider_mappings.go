package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Ensure instrument provider mappings table ")
			_, err := db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.instrument_provider_mappings (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					instrument_id UUID NOT NULL REFERENCES sigma_finance.instruments(id) ON DELETE CASCADE,
					provider VARCHAR(64) NOT NULL,
					provider_asset_id VARCHAR(255) NOT NULL,
					provider_symbol VARCHAR(255),
					provider_market VARCHAR(64),
					quote_currency VARCHAR(16),
					mapping_status VARCHAR(32) NOT NULL DEFAULT 'UNMAPPED',
					last_verified_at TIMESTAMP WITH TIME ZONE,
					last_error_text TEXT,
					created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
					updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
				);

				CREATE UNIQUE INDEX IF NOT EXISTS instrument_provider_mappings_identity_unique
					ON sigma_finance.instrument_provider_mappings(instrument_id, provider, provider_asset_id);

				CREATE INDEX IF NOT EXISTS instrument_provider_mappings_lookup_idx
					ON sigma_finance.instrument_provider_mappings(instrument_id, provider, mapping_status);
			`)
			if err != nil {
				fmt.Printf(" (failed - %v) ", err)
				return err
			}
			fmt.Print(" (ok) ")
			return nil
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] ")
			_, err := db.ExecContext(ctx, `
				DROP INDEX IF EXISTS sigma_finance.instrument_provider_mappings_lookup_idx;
				DROP INDEX IF EXISTS sigma_finance.instrument_provider_mappings_identity_unique;
				DROP TABLE IF EXISTS sigma_finance.instrument_provider_mappings;
			`)
			if err != nil {
				fmt.Printf(" (failed - %v) ", err)
				return err
			}
			fmt.Print(" (ok) ")
			return nil
		},
	)
}
