package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Fix transaction tables ")
			// Only create tables if they don't exist - this is safe and won't fail
			_, err := db.ExecContext(ctx, `
				-- Create transactions table only if it doesn't exist
				CREATE TABLE IF NOT EXISTS sigma_finance.transactions (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID NOT NULL,
					position_id UUID,
					type VARCHAR(20) NOT NULL,
					amount BIGINT NOT NULL,
					quantity DECIMAL(20,8),
					unit_price_amount DECIMAL(20,8),
					fee BIGINT DEFAULT 0,
					notes TEXT,
					executed_at TIMESTAMP WITH TIME ZONE NOT NULL,
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);
				
				-- Create transaction table (singular) for legacy support
				CREATE TABLE IF NOT EXISTS sigma_finance.transaction (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID NOT NULL,
					position_id UUID,
					type VARCHAR(20) NOT NULL,
					amount BIGINT NOT NULL,
					quantity DECIMAL(20,8),
					unit_price_amount DECIMAL(20,8),
					fee BIGINT DEFAULT 0,
					notes TEXT,
					executed_at TIMESTAMP WITH TIME ZONE NOT NULL,
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);
			`)
			if err != nil {
				fmt.Printf(" (warning: %v) ", err)
			}
			return nil
		},
		func(ctx context.Context, db *bun.DB) error {
			return nil
		},
	)
}
