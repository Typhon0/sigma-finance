package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add FUND asset type and fund table ")

			// Add FUND to the asset_type enum
			_, err := db.ExecContext(ctx, `
				ALTER TYPE asset_type ADD VALUE 'FUND';
			`)
			if err != nil {
				fmt.Printf(" (warning adding FUND to enum - may already exist: %v) ", err)
			}

			// Create fund table (mirrors stock table structure)
			_, err = db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.fund (
					asset_id UUID PRIMARY KEY REFERENCES sigma_finance.assets(id) ON DELETE CASCADE,
					ticker VARCHAR(20) NOT NULL,
					quantity DECIMAL(20,8) NOT NULL DEFAULT 0,
					buying_price DECIMAL(20,8)
				);
			`)
			if err != nil {
				return fmt.Errorf("fund table creation error: %w", err)
			}

			fmt.Print(" done")
			return nil
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Drop fund table ")
			_, err := db.ExecContext(ctx, `
				DROP TABLE IF EXISTS sigma_finance.fund;
			`)
			if err != nil {
				fmt.Printf(" (warning: %v) ", err)
			}
			// Note: PostgreSQL does not support removing enum values easily
			// The FUND value will remain in the enum but won't be used
			fmt.Print(" done")
			return nil
		},
	)
}
