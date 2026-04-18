package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add instrument catalog ")
			_, err := db.ExecContext(ctx, `
				CREATE EXTENSION IF NOT EXISTS pg_trgm;

				CREATE TABLE IF NOT EXISTS sigma_finance.instruments (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					symbol VARCHAR(50) NOT NULL,
					normalized_symbol VARCHAR(50) NOT NULL,
					name VARCHAR(255) NOT NULL,
					normalized_name VARCHAR(255) NOT NULL,
					exchange VARCHAR(100) NOT NULL,
					exchange_code VARCHAR(50),
					country VARCHAR(100),
					currency VARCHAR(20),
					summary TEXT,
					sector VARCHAR(255),
					industry_group VARCHAR(255),
					industry VARCHAR(255),
					category_group VARCHAR(255),
					category VARCHAR(255),
					family VARCHAR(255),
					website VARCHAR(255),
					market_cap VARCHAR(50),
					state VARCHAR(100),
					city VARCHAR(100),
					zipcode VARCHAR(50),
					base_currency VARCHAR(20),
					quote_currency VARCHAR(20),
					underlying_symbol VARCHAR(50),
					asset_type VARCHAR(20) NOT NULL,
					status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
					provider_source VARCHAR(100) NOT NULL,
					provider_external_id VARCHAR(255),
					isin VARCHAR(32),
					figi VARCHAR(32),
					cusip VARCHAR(32),
					metadata JSONB,
					first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
					last_verified_at TIMESTAMP WITH TIME ZONE,
					last_used_at TIMESTAMP WITH TIME ZONE,
					created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
					updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
				);

				CREATE TABLE IF NOT EXISTS sigma_finance.instrument_aliases (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					instrument_id UUID NOT NULL REFERENCES sigma_finance.instruments(id) ON DELETE CASCADE,
					alias_text VARCHAR(255) NOT NULL,
					normalized_alias_text VARCHAR(255) NOT NULL,
					alias_type VARCHAR(20) NOT NULL,
					created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
				);

				CREATE TABLE IF NOT EXISTS sigma_finance.instrument_sync_state (
					instrument_id UUID PRIMARY KEY REFERENCES sigma_finance.instruments(id) ON DELETE CASCADE,
					last_sync_attempt TIMESTAMP WITH TIME ZONE,
					last_sync_success TIMESTAMP WITH TIME ZONE,
					sync_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
					last_sync_source VARCHAR(100),
					sync_error_message TEXT,
					stale BOOLEAN NOT NULL DEFAULT false,
					verification_confidence INTEGER NOT NULL DEFAULT 0,
					created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
					updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
				);

				CREATE TABLE IF NOT EXISTS sigma_finance.discovery_logs (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					query_string VARCHAR(255) NOT NULL,
					provider_used VARCHAR(100) NOT NULL,
					number_of_results INTEGER NOT NULL DEFAULT 0,
					user_id UUID,
					selected_result_id UUID,
					persisted_instrument_id UUID,
					created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
				);

				ALTER TABLE sigma_finance.assets
					ADD COLUMN IF NOT EXISTS instrument_id UUID;
				ALTER TABLE sigma_finance.portfolio_asset
					ADD COLUMN IF NOT EXISTS instrument_id UUID;

				ALTER TABLE sigma_finance.assets
					ADD CONSTRAINT assets_instrument_id_fkey
					FOREIGN KEY (instrument_id) REFERENCES sigma_finance.instruments(id) ON DELETE SET NULL;
				ALTER TABLE sigma_finance.portfolio_asset
					ADD CONSTRAINT portfolio_asset_instrument_id_fkey
					FOREIGN KEY (instrument_id) REFERENCES sigma_finance.instruments(id) ON DELETE SET NULL;

				CREATE UNIQUE INDEX IF NOT EXISTS instruments_provider_identity_unique
					ON sigma_finance.instruments(provider_source, provider_external_id)
					WHERE provider_external_id IS NOT NULL;
				CREATE INDEX IF NOT EXISTS instruments_isin_idx
					ON sigma_finance.instruments(isin)
					WHERE isin IS NOT NULL;
				CREATE INDEX IF NOT EXISTS instruments_figi_idx
					ON sigma_finance.instruments(figi)
					WHERE figi IS NOT NULL;
				CREATE INDEX IF NOT EXISTS instruments_cusip_idx
					ON sigma_finance.instruments(cusip)
					WHERE cusip IS NOT NULL;
				CREATE UNIQUE INDEX IF NOT EXISTS instruments_symbol_exchange_type_unique
					ON sigma_finance.instruments(normalized_symbol, exchange, asset_type);
				CREATE INDEX IF NOT EXISTS instruments_status_idx
					ON sigma_finance.instruments(status);
				CREATE INDEX IF NOT EXISTS instruments_last_verified_idx
					ON sigma_finance.instruments(last_verified_at DESC);
				CREATE INDEX IF NOT EXISTS instruments_normalized_symbol_idx
					ON sigma_finance.instruments(normalized_symbol);
				CREATE INDEX IF NOT EXISTS instruments_normalized_name_trgm_idx
					ON sigma_finance.instruments USING GIN (normalized_name gin_trgm_ops);
				CREATE INDEX IF NOT EXISTS instruments_asset_type_idx
					ON sigma_finance.instruments(asset_type);
				CREATE INDEX IF NOT EXISTS instruments_country_idx
					ON sigma_finance.instruments(country);
				CREATE INDEX IF NOT EXISTS instruments_currency_idx
					ON sigma_finance.instruments(currency);
				CREATE INDEX IF NOT EXISTS instruments_sector_idx
					ON sigma_finance.instruments(sector);
				CREATE INDEX IF NOT EXISTS instruments_industry_idx
					ON sigma_finance.instruments(industry);
				CREATE INDEX IF NOT EXISTS instruments_category_idx
					ON sigma_finance.instruments(category);
				CREATE INDEX IF NOT EXISTS instruments_family_idx
					ON sigma_finance.instruments(family);
				CREATE INDEX IF NOT EXISTS instruments_exchange_code_idx
					ON sigma_finance.instruments(exchange_code);
				CREATE INDEX IF NOT EXISTS instruments_base_currency_idx
					ON sigma_finance.instruments(base_currency);
				CREATE INDEX IF NOT EXISTS instruments_quote_currency_idx
					ON sigma_finance.instruments(quote_currency);
				CREATE INDEX IF NOT EXISTS instruments_metadata_gin_idx
					ON sigma_finance.instruments USING GIN (metadata);
					CREATE INDEX IF NOT EXISTS instrument_aliases_normalized_alias_trgm_idx
						ON sigma_finance.instrument_aliases USING GIN (normalized_alias_text gin_trgm_ops);
					CREATE INDEX IF NOT EXISTS instrument_aliases_instrument_id_idx
						ON sigma_finance.instrument_aliases(instrument_id);
					CREATE UNIQUE INDEX IF NOT EXISTS instrument_aliases_unique
						ON sigma_finance.instrument_aliases(instrument_id, normalized_alias_text, alias_type);
					CREATE INDEX IF NOT EXISTS asset_instrument_id_idx
						ON sigma_finance.assets(instrument_id);
					CREATE INDEX IF NOT EXISTS portfolio_asset_instrument_id_idx
						ON sigma_finance.portfolio_asset(instrument_id);
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
				DROP INDEX IF EXISTS sigma_finance.portfolio_asset_instrument_id_idx;
				DROP INDEX IF EXISTS sigma_finance.asset_instrument_id_idx;
				DROP INDEX IF EXISTS sigma_finance.instrument_aliases_instrument_id_idx;
					DROP INDEX IF EXISTS sigma_finance.instrument_aliases_normalized_alias_trgm_idx;
					DROP INDEX IF EXISTS sigma_finance.instruments_normalized_name_trgm_idx;
					DROP INDEX IF EXISTS sigma_finance.instruments_normalized_symbol_idx;
					DROP INDEX IF EXISTS sigma_finance.instruments_last_verified_idx;
					DROP INDEX IF EXISTS sigma_finance.instruments_status_idx;
					DROP INDEX IF EXISTS sigma_finance.instruments_metadata_gin_idx;
					DROP INDEX IF EXISTS sigma_finance.instruments_quote_currency_idx;
					DROP INDEX IF EXISTS sigma_finance.instruments_base_currency_idx;
					DROP INDEX IF EXISTS sigma_finance.instruments_exchange_code_idx;
					DROP INDEX IF EXISTS sigma_finance.instruments_family_idx;
					DROP INDEX IF EXISTS sigma_finance.instruments_category_idx;
					DROP INDEX IF EXISTS sigma_finance.instruments_industry_idx;
					DROP INDEX IF EXISTS sigma_finance.instruments_sector_idx;
					DROP INDEX IF EXISTS sigma_finance.instruments_currency_idx;
					DROP INDEX IF EXISTS sigma_finance.instruments_country_idx;
					DROP INDEX IF EXISTS sigma_finance.instruments_asset_type_idx;
					DROP INDEX IF EXISTS sigma_finance.instruments_symbol_exchange_type_unique;
					DROP INDEX IF EXISTS sigma_finance.instruments_cusip_idx;
					DROP INDEX IF EXISTS sigma_finance.instruments_figi_idx;
					DROP INDEX IF EXISTS sigma_finance.instruments_isin_idx;
					DROP INDEX IF EXISTS sigma_finance.instruments_provider_identity_unique;
					DROP INDEX IF EXISTS sigma_finance.instrument_aliases_unique;

					ALTER TABLE sigma_finance.portfolio_asset DROP CONSTRAINT IF EXISTS portfolio_asset_instrument_id_fkey;
					ALTER TABLE sigma_finance.assets DROP CONSTRAINT IF EXISTS assets_instrument_id_fkey;
					ALTER TABLE sigma_finance.portfolio_asset DROP COLUMN IF EXISTS instrument_id;
					ALTER TABLE sigma_finance.assets DROP COLUMN IF EXISTS instrument_id;

				DROP TABLE IF EXISTS sigma_finance.discovery_logs;
				DROP TABLE IF EXISTS sigma_finance.instrument_sync_state;
				DROP TABLE IF EXISTS sigma_finance.instrument_aliases;
				DROP TABLE IF EXISTS sigma_finance.instruments;
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
