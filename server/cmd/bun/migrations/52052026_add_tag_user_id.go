package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add user_id to tag table with composite unique constraint ")
			_, err := db.ExecContext(ctx, `
				-- Add user_id column, nullable initially
				ALTER TABLE sigma_finance.tag
				ADD COLUMN IF NOT EXISTS user_id UUID;

				-- Assign a default UUID to existing rows so we can make it NOT NULL
				-- Existing tags were global; we assign them to a sentinel user_id
				UPDATE sigma_finance.tag
				SET user_id = '00000000-0000-0000-0000-000000000000'
				WHERE user_id IS NULL;

				-- Make user_id NOT NULL
				ALTER TABLE sigma_finance.tag
				ALTER COLUMN user_id SET NOT NULL;

				-- Drop the old unique constraint on name only
				ALTER TABLE sigma_finance.tag
				DROP CONSTRAINT IF EXISTS tag_name_key;

				-- Add composite unique constraint on (user_id, name)
				ALTER TABLE sigma_finance.tag
				ADD CONSTRAINT tag_user_id_name_key UNIQUE (user_id, name);
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Revert tag to name-only unique constraint ")
			_, err := db.ExecContext(ctx, `
				-- Drop the composite unique constraint
				ALTER TABLE sigma_finance.tag
				DROP CONSTRAINT IF EXISTS tag_user_id_name_key;

				-- Restore old unique constraint on name only
				ALTER TABLE sigma_finance.tag
				ADD CONSTRAINT tag_name_key UNIQUE (name);

				-- Remove user_id column
				ALTER TABLE sigma_finance.tag
				DROP COLUMN IF EXISTS user_id;
			`)
			return err
		},
	)
}
