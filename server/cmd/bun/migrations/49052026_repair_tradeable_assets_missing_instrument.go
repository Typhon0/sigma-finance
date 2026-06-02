package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Repair tradeable assets missing instrument links ")
			_, err := db.ExecContext(ctx, `
				WITH ranked_matches AS (
					SELECT
						a.id AS asset_id,
						i.id AS instrument_id,
						ROW_NUMBER() OVER (
							PARTITION BY a.id
							ORDER BY
								CASE WHEN LOWER(COALESCE(i.provider_source, '')) = 'manual' THEN 1 ELSE 0 END,
								i.updated_at DESC
						) AS rn
					FROM sigma_finance.assets a
					JOIN sigma_finance.instruments i
						ON UPPER(TRIM(COALESCE(a.symbol, ''))) = UPPER(TRIM(i.symbol))
					WHERE
						a.is_tradeable = TRUE
						AND a.instrument_id IS NULL
						AND a.type IN ('STOCK', 'FUND', 'CRYPTO')
						AND i.status <> 'ARCHIVED'
						AND (
							(a.type = 'STOCK' AND i.asset_type = 'STOCK')
							OR (a.type = 'FUND' AND i.asset_type IN ('FUND', 'ETF'))
							OR (a.type = 'CRYPTO' AND i.asset_type = 'CRYPTO')
						)
				)
				UPDATE sigma_finance.assets a
				SET
					instrument_id = rm.instrument_id,
					updated_at = current_timestamp
				FROM ranked_matches rm
				WHERE
					a.id = rm.asset_id
					AND rm.rn = 1;

				INSERT INTO sigma_finance.instrument_provider_mappings (
					instrument_id,
					provider,
					provider_asset_id,
					provider_symbol,
					quote_currency,
					mapping_status,
					last_verified_at,
					created_at,
					updated_at
				)
				SELECT
					i.id AS instrument_id,
					'YFINANCE' AS provider,
					CASE
						WHEN i.asset_type = 'CRYPTO' AND POSITION('-' IN COALESCE(i.symbol, '')) = 0 THEN UPPER(TRIM(i.symbol)) || '-USD'
						ELSE UPPER(TRIM(i.symbol))
					END AS provider_asset_id,
					CASE
						WHEN i.asset_type = 'CRYPTO' AND POSITION('-' IN COALESCE(i.symbol, '')) = 0 THEN UPPER(TRIM(i.symbol)) || '-USD'
						ELSE UPPER(TRIM(i.symbol))
					END AS provider_symbol,
					'USD' AS quote_currency,
					'VERIFIED' AS mapping_status,
					current_timestamp AS last_verified_at,
					current_timestamp AS created_at,
					current_timestamp AS updated_at
				FROM sigma_finance.instruments i
				JOIN sigma_finance.assets a ON a.instrument_id = i.id
				WHERE
					a.is_tradeable = TRUE
					AND i.asset_type IN ('STOCK', 'ETF', 'FUND', 'CRYPTO')
					AND UPPER(TRIM(COALESCE(i.symbol, ''))) <> ''
					AND UPPER(TRIM(COALESCE(i.symbol, ''))) NOT IN ('EQUITIES', 'EQUITY', 'STOCK', 'STOCKS', 'FUND', 'FUNDS', 'ETF', 'ETFS', 'CRYPTO', 'CRYPTOS')
				ON CONFLICT (instrument_id, provider, provider_asset_id)
				DO UPDATE SET
					provider_symbol = EXCLUDED.provider_symbol,
					quote_currency = COALESCE(EXCLUDED.quote_currency, sigma_finance.instrument_provider_mappings.quote_currency),
					mapping_status = EXCLUDED.mapping_status,
					last_verified_at = EXCLUDED.last_verified_at,
					last_error_text = NULL,
					updated_at = EXCLUDED.updated_at;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Repair tradeable assets missing instrument links ")
			_, err := db.ExecContext(ctx, `SELECT 1;`)
			return err
		},
	)
}
