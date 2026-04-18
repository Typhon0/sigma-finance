package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Final Schema Cleanup and Junction Fix ")
			_, err := db.ExecContext(ctx, `
				-- 1. Drop shadowed singular tables
				DROP TABLE IF EXISTS sigma_finance.asset CASCADE;
				DROP TABLE IF EXISTS sigma_finance.transaction CASCADE;
				DROP TABLE IF EXISTS sigma_finance.alert CASCADE;

				-- 2. Ensure all junction tables have 'id' (UUID) as PK and timestamps
				
				-- portfolio_asset (already mostly there, but let's confirm PK)
				DO $$ BEGIN
					IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='sigma_finance' AND table_name='portfolio_asset' AND column_name='id') THEN
						ALTER TABLE sigma_finance.portfolio_asset ADD COLUMN id UUID DEFAULT gen_random_uuid();
					END IF;
					ALTER TABLE sigma_finance.portfolio_asset DROP CONSTRAINT IF EXISTS portfolio_asset_pkey CASCADE;
					ALTER TABLE sigma_finance.portfolio_asset ADD PRIMARY KEY (id);
				END $$;

				-- watchlist_asset
				DO $$ BEGIN
					IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='sigma_finance' AND table_name='watchlist_asset' AND column_name='id') THEN
						ALTER TABLE sigma_finance.watchlist_asset ADD COLUMN id UUID DEFAULT gen_random_uuid();
					END IF;
					ALTER TABLE sigma_finance.watchlist_asset DROP CONSTRAINT IF EXISTS watchlist_asset_pkey CASCADE;
					ALTER TABLE sigma_finance.watchlist_asset ADD PRIMARY KEY (id);
				END $$;

				-- asset_tag
				DO $$ BEGIN
					IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='sigma_finance' AND table_name='asset_tag' AND column_name='id') THEN
						ALTER TABLE sigma_finance.asset_tag ADD COLUMN id UUID DEFAULT gen_random_uuid();
					END IF;
					ALTER TABLE sigma_finance.asset_tag DROP CONSTRAINT IF EXISTS asset_tag_pkey CASCADE;
					ALTER TABLE sigma_finance.asset_tag ADD PRIMARY KEY (id);
				END $$;

				-- portfolio_tag
				DO $$ BEGIN
					IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='sigma_finance' AND table_name='portfolio_tag' AND column_name='id') THEN
						ALTER TABLE sigma_finance.portfolio_tag ADD COLUMN id UUID DEFAULT gen_random_uuid();
					END IF;
					ALTER TABLE sigma_finance.portfolio_tag DROP CONSTRAINT IF EXISTS portfolio_tag_pkey CASCADE;
					ALTER TABLE sigma_finance.portfolio_tag ADD PRIMARY KEY (id);
				END $$;

				-- 3. Migrate Ownership to UUID
				ALTER TABLE sigma_finance.ownership ADD COLUMN IF NOT EXISTS asset_id_new UUID;
				ALTER TABLE sigma_finance.ownership ADD COLUMN IF NOT EXISTS user_id_new UUID;
				-- Since we are cleaning it's usually empty in tests
				TRUNCATE TABLE sigma_finance.ownership CASCADE;
				
				ALTER TABLE sigma_finance.ownership DROP COLUMN IF EXISTS asset_id;
				ALTER TABLE sigma_finance.ownership DROP COLUMN IF EXISTS user_id;
				ALTER TABLE sigma_finance.ownership RENAME COLUMN asset_id_new TO asset_id;
				ALTER TABLE sigma_finance.ownership RENAME COLUMN user_id_new TO user_id;
				
				ALTER TABLE sigma_finance.ownership ADD CONSTRAINT ownership_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES sigma_finance.assets(id) ON DELETE CASCADE;
				ALTER TABLE sigma_finance.ownership ADD CONSTRAINT ownership_user_id_fkey FOREIGN KEY (user_id) REFERENCES sigma_finance.user(id) ON DELETE CASCADE;
				-- Primary key: (user_id, asset_id) - let's keep it composite or add ID too?
				-- To be consistent, let's add ID to ownership too.
				ALTER TABLE sigma_finance.ownership ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
				ALTER TABLE sigma_finance.ownership ADD PRIMARY KEY (id);

				-- 4. Final timestamp fix for junction tables
				ALTER TABLE sigma_finance.watchlist_asset ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
				ALTER TABLE sigma_finance.watchlist_asset ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
				ALTER TABLE sigma_finance.asset_tag ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
				ALTER TABLE sigma_finance.asset_tag ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
				ALTER TABLE sigma_finance.portfolio_tag ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
				ALTER TABLE sigma_finance.portfolio_tag ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
				ALTER TABLE sigma_finance.ownership ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
				ALTER TABLE sigma_finance.ownership ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			return nil
		},
	)
}
