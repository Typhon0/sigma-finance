package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Verify database tables are accessible ")

			// Just verify we can access the database by doing a simple query
			var count int
			err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM sigma_finance.user").Scan(&count)
			if err != nil {
				fmt.Printf(" (warning: user table access issue: %v) ", err)
			} else {
				fmt.Printf(" (user table accessible, %d users) ", count)
			}

			return nil
		},
		func(ctx context.Context, db *bun.DB) error {
			return nil
		},
	)
}
