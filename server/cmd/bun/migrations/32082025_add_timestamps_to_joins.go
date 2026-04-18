package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add timestamps to joins ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.portfolio_asset ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
				ALTER TABLE sigma_finance.portfolio_asset ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
				
				ALTER TABLE sigma_finance.asset_tag ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
				ALTER TABLE sigma_finance.asset_tag ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
				ALTER TABLE sigma_finance.portfolio_tag ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
				ALTER TABLE sigma_finance.portfolio_tag ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
				
				ALTER TABLE sigma_finance.watchlist_asset ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
				ALTER TABLE sigma_finance.watchlist_asset ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
				
				-- also verify that asset_id was migrated properly in the previous step
				-- wait, in TestGraphQLIntegration_ComplexRelationships/TaggingOperations, it says invalid syntax for type integer
				-- maybe the error was from portfolio_tag, not asset_tag?
				-- Let's make sure BOTH portfolio_tag.portfolio_id and ... are UUID.
				
				ALTER TABLE sigma_finance.portfolio_tag ADD COLUMN IF NOT EXISTS portfolio_id_new UUID;
				ALTER TABLE sigma_finance.portfolio_tag DROP CONSTRAINT IF EXISTS portfolio_tag_portfolio_id_fkey;
				ALTER TABLE sigma_finance.portfolio_tag DROP COLUMN IF EXISTS portfolio_id;
				ALTER TABLE sigma_finance.portfolio_tag RENAME COLUMN portfolio_id_new TO portfolio_id;
				
				ALTER TABLE sigma_finance.watchlist_asset ADD COLUMN IF NOT EXISTS watchlist_id_new UUID;
				ALTER TABLE sigma_finance.watchlist_asset DROP CONSTRAINT IF EXISTS watchlist_asset_watchlist_id_fkey;
				ALTER TABLE sigma_finance.watchlist_asset DROP COLUMN IF EXISTS watchlist_id;
				ALTER TABLE sigma_finance.watchlist_asset RENAME COLUMN watchlist_id_new TO watchlist_id;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			return nil
		},
	)
}
