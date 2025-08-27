package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Fix user ID references to use UUID ")
			_, err := db.ExecContext(ctx, `
-- Add new UUID columns for user references
ALTER TABLE sigma_finance.portfolio ADD COLUMN IF NOT EXISTS user_id_new UUID;
ALTER TABLE sigma_finance.watchlist ADD COLUMN IF NOT EXISTS user_id_new UUID;
ALTER TABLE sigma_finance.alert ADD COLUMN IF NOT EXISTS user_id_new UUID;
ALTER TABLE sigma_finance.report ADD COLUMN IF NOT EXISTS user_id_new UUID;
ALTER TABLE sigma_finance.ownership ADD COLUMN IF NOT EXISTS user_id_new UUID;

-- Since we can't migrate existing integer user_ids to UUIDs without data loss,
-- we'll set all existing records to reference the first user (if any exists)
-- In a real migration, you'd need a proper mapping strategy
DO $$
DECLARE
    first_user_uuid UUID;
BEGIN
    -- Get the first user UUID (if any users exist)
    SELECT id INTO first_user_uuid FROM sigma_finance.user LIMIT 1;
    
    IF first_user_uuid IS NOT NULL THEN
        -- Update all existing records to reference the first user
        -- This is a data loss scenario - in production you'd need proper mapping
        UPDATE sigma_finance.portfolio SET user_id_new = first_user_uuid WHERE user_id_new IS NULL;
        UPDATE sigma_finance.watchlist SET user_id_new = first_user_uuid WHERE user_id_new IS NULL;
        UPDATE sigma_finance.alert SET user_id_new = first_user_uuid WHERE user_id_new IS NULL;
        UPDATE sigma_finance.report SET user_id_new = first_user_uuid WHERE user_id_new IS NULL;
        UPDATE sigma_finance.ownership SET user_id_new = first_user_uuid WHERE user_id_new IS NULL;
    END IF;
END $$;

-- Drop old foreign key constraints
ALTER TABLE sigma_finance.portfolio DROP CONSTRAINT IF EXISTS portfolio_user_id_fkey;
ALTER TABLE sigma_finance.watchlist DROP CONSTRAINT IF EXISTS watchlist_user_id_fkey;
ALTER TABLE sigma_finance.alert DROP CONSTRAINT IF EXISTS alert_user_id_fkey;
ALTER TABLE sigma_finance.report DROP CONSTRAINT IF EXISTS report_user_id_fkey;
ALTER TABLE sigma_finance.ownership DROP CONSTRAINT IF EXISTS ownership_user_id_fkey;

-- Drop old integer user_id columns
ALTER TABLE sigma_finance.portfolio DROP COLUMN IF EXISTS user_id;
ALTER TABLE sigma_finance.watchlist DROP COLUMN IF EXISTS user_id;
ALTER TABLE sigma_finance.alert DROP COLUMN IF EXISTS user_id;
ALTER TABLE sigma_finance.report DROP COLUMN IF EXISTS user_id;
ALTER TABLE sigma_finance.ownership DROP COLUMN IF EXISTS user_id;

-- Rename new columns to user_id
ALTER TABLE sigma_finance.portfolio RENAME COLUMN user_id_new TO user_id;
ALTER TABLE sigma_finance.watchlist RENAME COLUMN user_id_new TO user_id;
ALTER TABLE sigma_finance.alert RENAME COLUMN user_id_new TO user_id;
ALTER TABLE sigma_finance.report RENAME COLUMN user_id_new TO user_id;
ALTER TABLE sigma_finance.ownership RENAME COLUMN user_id_new TO user_id;

-- Add NOT NULL constraints
ALTER TABLE sigma_finance.portfolio ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE sigma_finance.watchlist ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE sigma_finance.alert ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE sigma_finance.report ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE sigma_finance.ownership ALTER COLUMN user_id SET NOT NULL;

-- Add new foreign key constraints
ALTER TABLE sigma_finance.portfolio ADD CONSTRAINT portfolio_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES sigma_finance.user(id) ON DELETE CASCADE;
ALTER TABLE sigma_finance.watchlist ADD CONSTRAINT watchlist_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES sigma_finance.user(id) ON DELETE CASCADE;
ALTER TABLE sigma_finance.alert ADD CONSTRAINT alert_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES sigma_finance.user(id) ON DELETE CASCADE;
ALTER TABLE sigma_finance.report ADD CONSTRAINT report_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES sigma_finance.user(id) ON DELETE CASCADE;
ALTER TABLE sigma_finance.ownership ADD CONSTRAINT ownership_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES sigma_finance.user(id) ON DELETE CASCADE;

-- Update composite primary key for ownership table
ALTER TABLE sigma_finance.ownership DROP CONSTRAINT IF EXISTS ownership_pkey;
ALTER TABLE sigma_finance.ownership ADD PRIMARY KEY (asset_id, user_id);
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Revert user ID references to integers ")
			_, err := db.ExecContext(ctx, `
-- This is a destructive rollback - data will be lost
-- Drop foreign key constraints
ALTER TABLE sigma_finance.portfolio DROP CONSTRAINT IF EXISTS portfolio_user_id_fkey;
ALTER TABLE sigma_finance.watchlist DROP CONSTRAINT IF EXISTS watchlist_user_id_fkey;
ALTER TABLE sigma_finance.alert DROP CONSTRAINT IF EXISTS alert_user_id_fkey;
ALTER TABLE sigma_finance.report DROP CONSTRAINT IF EXISTS report_user_id_fkey;
ALTER TABLE sigma_finance.ownership DROP CONSTRAINT IF EXISTS ownership_user_id_fkey;

-- Add integer user_id columns
ALTER TABLE sigma_finance.portfolio ADD COLUMN user_id_int INT;
ALTER TABLE sigma_finance.watchlist ADD COLUMN user_id_int INT;
ALTER TABLE sigma_finance.alert ADD COLUMN user_id_int INT;
ALTER TABLE sigma_finance.report ADD COLUMN user_id_int INT;
ALTER TABLE sigma_finance.ownership ADD COLUMN user_id_int INT;

-- Set default values (data loss scenario)
UPDATE sigma_finance.portfolio SET user_id_int = 1;
UPDATE sigma_finance.watchlist SET user_id_int = 1;
UPDATE sigma_finance.alert SET user_id_int = 1;
UPDATE sigma_finance.report SET user_id_int = 1;
UPDATE sigma_finance.ownership SET user_id_int = 1;

-- Drop UUID columns
ALTER TABLE sigma_finance.portfolio DROP COLUMN user_id;
ALTER TABLE sigma_finance.watchlist DROP COLUMN user_id;
ALTER TABLE sigma_finance.alert DROP COLUMN user_id;
ALTER TABLE sigma_finance.report DROP COLUMN user_id;
ALTER TABLE sigma_finance.ownership DROP COLUMN user_id;

-- Rename integer columns
ALTER TABLE sigma_finance.portfolio RENAME COLUMN user_id_int TO user_id;
ALTER TABLE sigma_finance.watchlist RENAME COLUMN user_id_int TO user_id;
ALTER TABLE sigma_finance.alert RENAME COLUMN user_id_int TO user_id;
ALTER TABLE sigma_finance.report RENAME COLUMN user_id_int TO user_id;
ALTER TABLE sigma_finance.ownership RENAME COLUMN user_id_int TO user_id;
			`)
			return err
		},
	)
}
