package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Complete UUID migration ")
			_, err := db.ExecContext(ctx, `
				-- 1. Add ID to portfolio_asset
				ALTER TABLE sigma_finance.portfolio_asset ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
				
				-- 2. Migrate tag to UUID
				ALTER TABLE sigma_finance.tag ADD COLUMN IF NOT EXISTS id_new UUID DEFAULT gen_random_uuid();
				UPDATE sigma_finance.tag SET id_new = gen_random_uuid() WHERE id_new IS NULL;
				
				ALTER TABLE sigma_finance.asset_tag ADD COLUMN IF NOT EXISTS tag_id_new UUID;
				ALTER TABLE sigma_finance.portfolio_tag ADD COLUMN IF NOT EXISTS tag_id_new UUID;
				
				UPDATE sigma_finance.asset_tag SET tag_id_new = t.id_new FROM sigma_finance.tag t WHERE sigma_finance.asset_tag.tag_id = t.id;
				UPDATE sigma_finance.portfolio_tag SET tag_id_new = t.id_new FROM sigma_finance.tag t WHERE sigma_finance.portfolio_tag.tag_id = t.id;
				
				ALTER TABLE sigma_finance.asset_tag DROP CONSTRAINT IF EXISTS asset_tag_tag_id_fkey;
				ALTER TABLE sigma_finance.portfolio_tag DROP CONSTRAINT IF EXISTS portfolio_tag_tag_id_fkey;
				
				ALTER TABLE sigma_finance.tag DROP CONSTRAINT IF EXISTS tag_pkey CASCADE;
				ALTER TABLE sigma_finance.tag DROP COLUMN IF EXISTS id;
				ALTER TABLE sigma_finance.tag RENAME COLUMN id_new TO id;
				ALTER TABLE sigma_finance.tag ADD PRIMARY KEY (id);
				
				ALTER TABLE sigma_finance.asset_tag DROP COLUMN IF EXISTS tag_id;
				ALTER TABLE sigma_finance.asset_tag RENAME COLUMN tag_id_new TO tag_id;
				
				ALTER TABLE sigma_finance.portfolio_tag DROP COLUMN IF EXISTS tag_id;
				ALTER TABLE sigma_finance.portfolio_tag RENAME COLUMN tag_id_new TO tag_id;
				
				-- 3. Migrate watchlist to UUID
				ALTER TABLE sigma_finance.watchlist ADD COLUMN IF NOT EXISTS id_new UUID DEFAULT gen_random_uuid();
				UPDATE sigma_finance.watchlist SET id_new = gen_random_uuid() WHERE id_new IS NULL;
				
				ALTER TABLE sigma_finance.watchlist_asset ADD COLUMN IF NOT EXISTS watchlist_id_new UUID;
				UPDATE sigma_finance.watchlist_asset SET watchlist_id_new = w.id_new FROM sigma_finance.watchlist w WHERE sigma_finance.watchlist_asset.watchlist_id = w.id;
				
				ALTER TABLE sigma_finance.watchlist_asset DROP CONSTRAINT IF EXISTS watchlist_asset_watchlist_id_fkey;
				
				ALTER TABLE sigma_finance.watchlist DROP CONSTRAINT IF EXISTS watchlist_pkey CASCADE;
				ALTER TABLE sigma_finance.watchlist DROP COLUMN IF EXISTS id;
				ALTER TABLE sigma_finance.watchlist RENAME COLUMN id_new TO id;
				ALTER TABLE sigma_finance.watchlist ADD PRIMARY KEY (id);
				
				ALTER TABLE sigma_finance.watchlist_asset DROP COLUMN IF EXISTS watchlist_id;
				ALTER TABLE sigma_finance.watchlist_asset RENAME COLUMN watchlist_id_new TO watchlist_id;
				
				-- 4. Update join tables to point to assets(uuid) instead of asset(int)
				
				-- portfolio_asset.asset_id
				ALTER TABLE sigma_finance.portfolio_asset ADD COLUMN IF NOT EXISTS asset_id_new UUID;
				-- Assume for now they are empty or we can just empty them because we can't map integer to UUID without a mapping table
				TRUNCATE TABLE sigma_finance.portfolio_asset CASCADE;
				TRUNCATE TABLE sigma_finance.asset_tag CASCADE;
				TRUNCATE TABLE sigma_finance.portfolio_tag CASCADE;
				TRUNCATE TABLE sigma_finance.watchlist_asset CASCADE;
				
				ALTER TABLE sigma_finance.portfolio_asset DROP CONSTRAINT IF EXISTS portfolio_asset_asset_id_fkey;
				ALTER TABLE sigma_finance.portfolio_asset DROP COLUMN IF EXISTS asset_id;
				ALTER TABLE sigma_finance.portfolio_asset RENAME COLUMN asset_id_new TO asset_id;
				ALTER TABLE sigma_finance.portfolio_asset ALTER COLUMN asset_id SET NOT NULL;
				
				-- asset_tag.asset_id
				ALTER TABLE sigma_finance.asset_tag ADD COLUMN IF NOT EXISTS asset_id_new UUID;
				ALTER TABLE sigma_finance.asset_tag DROP CONSTRAINT IF EXISTS asset_tag_asset_id_fkey;
				ALTER TABLE sigma_finance.asset_tag DROP COLUMN IF EXISTS asset_id;
				ALTER TABLE sigma_finance.asset_tag RENAME COLUMN asset_id_new TO asset_id;
				ALTER TABLE sigma_finance.asset_tag ALTER COLUMN asset_id SET NOT NULL;
				
				-- watchlist_asset.asset_id
				ALTER TABLE sigma_finance.watchlist_asset ADD COLUMN IF NOT EXISTS asset_id_new UUID;
				ALTER TABLE sigma_finance.watchlist_asset DROP CONSTRAINT IF EXISTS watchlist_asset_asset_id_fkey;
				ALTER TABLE sigma_finance.watchlist_asset DROP COLUMN IF EXISTS asset_id;
				ALTER TABLE sigma_finance.watchlist_asset RENAME COLUMN asset_id_new TO asset_id;
				ALTER TABLE sigma_finance.watchlist_asset ALTER COLUMN asset_id SET NOT NULL;
				
				-- Transaction table asset_id, portfolio_id handling
				-- Transaction to UUID
				ALTER TABLE sigma_finance.transaction ADD COLUMN IF NOT EXISTS id_new UUID DEFAULT gen_random_uuid();
				ALTER TABLE sigma_finance.transaction DROP CONSTRAINT IF EXISTS transaction_pkey CASCADE;
				ALTER TABLE sigma_finance.transaction DROP COLUMN IF EXISTS id;
				ALTER TABLE sigma_finance.transaction RENAME COLUMN id_new TO id;
				ALTER TABLE sigma_finance.transaction ADD PRIMARY KEY (id);
				
				-- Transaction -> asset_id (UUID)
				TRUNCATE TABLE sigma_finance.transaction CASCADE;
				ALTER TABLE sigma_finance.transaction ADD COLUMN IF NOT EXISTS asset_id_new UUID;
				ALTER TABLE sigma_finance.transaction DROP CONSTRAINT IF EXISTS transaction_asset_id_fkey;
				ALTER TABLE sigma_finance.transaction DROP COLUMN IF EXISTS asset_id;
				ALTER TABLE sigma_finance.transaction RENAME COLUMN asset_id_new TO asset_id;
				ALTER TABLE sigma_finance.transaction ALTER COLUMN asset_id SET NOT NULL;
				
				-- Transaction -> portfolio_id (UUID)
				ALTER TABLE sigma_finance.transaction ADD COLUMN IF NOT EXISTS portfolio_id_new UUID;
				ALTER TABLE sigma_finance.transaction DROP CONSTRAINT IF EXISTS transaction_portfolio_id_fkey;
				ALTER TABLE sigma_finance.transaction DROP COLUMN IF EXISTS portfolio_id;
				ALTER TABLE sigma_finance.transaction RENAME COLUMN portfolio_id_new TO portfolio_id;
				
				-- Add foreign keys back
				ALTER TABLE sigma_finance.asset_tag ADD CONSTRAINT asset_tag_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES sigma_finance.tag(id) ON DELETE CASCADE;
				ALTER TABLE sigma_finance.portfolio_tag ADD CONSTRAINT portfolio_tag_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES sigma_finance.tag(id) ON DELETE CASCADE;
				ALTER TABLE sigma_finance.portfolio_asset ADD CONSTRAINT portfolio_asset_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES sigma_finance.assets(id) ON DELETE CASCADE;
				ALTER TABLE sigma_finance.asset_tag ADD CONSTRAINT asset_tag_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES sigma_finance.assets(id) ON DELETE CASCADE;
				ALTER TABLE sigma_finance.watchlist_asset ADD CONSTRAINT watchlist_asset_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES sigma_finance.assets(id) ON DELETE CASCADE;
				ALTER TABLE sigma_finance.transaction ADD CONSTRAINT transaction_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES sigma_finance.assets(id) ON DELETE CASCADE;
				ALTER TABLE sigma_finance.transaction ADD CONSTRAINT transaction_portfolio_id_fkey FOREIGN KEY (portfolio_id) REFERENCES sigma_finance.portfolio(id) ON DELETE CASCADE;

			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Complete UUID migration ")
			return nil
		},
	)
}
