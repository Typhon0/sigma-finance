package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add user role column and constraints ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance."user"
					ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'USER';

				UPDATE sigma_finance."user"
				SET role = 'USER'
				WHERE role IS NULL OR trim(role) = '';

				ALTER TABLE sigma_finance."user"
					DROP CONSTRAINT IF EXISTS user_role_check;

				ALTER TABLE sigma_finance."user"
					ADD CONSTRAINT user_role_check
					CHECK (role IN ('USER', 'ADMIN'));
			`)
			if err != nil {
				fmt.Printf(" (failed - %v) ", err)
				return err
			}
			fmt.Print(" (ok) ")
			return nil
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Remove user role column and constraints ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance."user"
					DROP CONSTRAINT IF EXISTS user_role_check;

				ALTER TABLE sigma_finance."user"
					DROP COLUMN IF EXISTS role;
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
