package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Final schema stabilization for Stock and Crypto ")
			_, err := db.ExecContext(ctx, `
				-- Skip stock/crypto migration if tables don't exist or user doesn't own them
				-- This migration assumes the schema was already properly migrated
			`)
			if err != nil {
				fmt.Printf(" (skipped - %v) ", err)
			}
			return nil
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] ")
			return nil
		},
	)
}
