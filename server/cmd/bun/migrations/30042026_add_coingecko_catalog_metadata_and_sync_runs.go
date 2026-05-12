package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add CoinGecko catalog metadata and sync runs ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.instruments
					ADD COLUMN IF NOT EXISTS external_source VARCHAR(64),
					ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
					ADD COLUMN IF NOT EXISTS platforms_json JSONB,
					ADD COLUMN IF NOT EXISTS primary_contract_address VARCHAR(255),
					ADD COLUMN IF NOT EXISTS instrument_status VARCHAR(32),
					ADD COLUMN IF NOT EXISTS market_cap_rank INTEGER,
					ADD COLUMN IF NOT EXISTS image_url TEXT,
					ADD COLUMN IF NOT EXISTS metadata_updated_at TIMESTAMP WITH TIME ZONE;

				ALTER TABLE sigma_finance.market_data_credential
					ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
					ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 100,
					ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMP WITH TIME ZONE;

				DROP INDEX IF EXISTS sigma_finance.instruments_provider_identity_unique;

				CREATE UNIQUE INDEX IF NOT EXISTS instruments_external_identity_unique
					ON sigma_finance.instruments(external_source, external_id)
					WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

				CREATE INDEX IF NOT EXISTS instruments_primary_contract_address_idx
					ON sigma_finance.instruments(primary_contract_address);

				CREATE INDEX IF NOT EXISTS instruments_crypto_search_idx
					ON sigma_finance.instruments(normalized_symbol, normalized_name, external_id);

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

				CREATE TABLE IF NOT EXISTS sigma_finance.catalog_sync_runs (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					source VARCHAR(64) NOT NULL,
					mode VARCHAR(64) NOT NULL,
					status VARCHAR(32) NOT NULL,
					cursor TEXT,
					stats_json JSONB,
					error_text TEXT,
					started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
					finished_at TIMESTAMP WITH TIME ZONE
				);

				CREATE INDEX IF NOT EXISTS catalog_sync_runs_source_started_at_idx
					ON sigma_finance.catalog_sync_runs(source, started_at DESC);
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
				DROP INDEX IF EXISTS sigma_finance.catalog_sync_runs_source_started_at_idx;
				DROP TABLE IF EXISTS sigma_finance.catalog_sync_runs;
				DROP INDEX IF EXISTS sigma_finance.instrument_provider_mappings_lookup_idx;
				DROP INDEX IF EXISTS sigma_finance.instrument_provider_mappings_identity_unique;
				DROP TABLE IF EXISTS sigma_finance.instrument_provider_mappings;
				DROP INDEX IF EXISTS sigma_finance.instruments_crypto_search_idx;
				DROP INDEX IF EXISTS sigma_finance.instruments_primary_contract_address_idx;
				DROP INDEX IF EXISTS sigma_finance.instruments_external_identity_unique;
				ALTER TABLE sigma_finance.market_data_credential
					DROP COLUMN IF EXISTS last_validated_at,
					DROP COLUMN IF EXISTS priority,
					DROP COLUMN IF EXISTS is_enabled;
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
