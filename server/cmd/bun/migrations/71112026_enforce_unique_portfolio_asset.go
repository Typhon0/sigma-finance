package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Enforce unique portfolio_asset per (portfolio_id, asset_id) ")

			_, err := db.ExecContext(ctx, `
				-- Deduplicate any existing rows by keeping the aggregated values
				DELETE FROM sigma_finance.portfolio_asset WHERE id NOT IN (
					SELECT DISTINCT ON (portfolio_id, asset_id) id
					FROM sigma_finance.portfolio_asset
					ORDER BY portfolio_id, asset_id, updated_at DESC
				);

				CREATE UNIQUE INDEX IF NOT EXISTS uq_portfolio_asset_portfolio_asset 
				ON sigma_finance.portfolio_asset (portfolio_id, asset_id);
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Drop unique index on portfolio_asset ")
			_, err := db.ExecContext(ctx, `
				DROP INDEX IF EXISTS sigma_finance.uq_portfolio_asset_portfolio_asset;
			`)
			return err
		},
	)
}
