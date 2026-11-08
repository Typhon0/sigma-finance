package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Print(" [up migration] add co_owner_name and co_owner_user_id to accounts...")
		_, err := db.ExecContext(ctx, `
			ALTER TABLE sigma_finance.accounts
			ADD COLUMN IF NOT EXISTS co_owner_name varchar(255),
			ADD COLUMN IF NOT EXISTS co_owner_user_id uuid REFERENCES sigma_finance.user(id) ON DELETE SET NULL;
		`)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Print(" [down migration] drop co_owner_name and co_owner_user_id from accounts...")
		_, err := db.ExecContext(ctx, `
			ALTER TABLE sigma_finance.accounts
			DROP COLUMN IF EXISTS co_owner_name,
			DROP COLUMN IF EXISTS co_owner_user_id;
		`)
		return err
	})
}

