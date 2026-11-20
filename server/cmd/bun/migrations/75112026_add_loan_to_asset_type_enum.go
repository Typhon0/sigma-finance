package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Print(" [up migration] ensure assets.type is varchar(50) to support LOAN and future asset types...")
		_, err := db.ExecContext(ctx, `
			ALTER TABLE sigma_finance.assets ALTER COLUMN type TYPE VARCHAR(50);
		`)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Print(" [down migration] revert assets.type...")
		return nil
	})
}
