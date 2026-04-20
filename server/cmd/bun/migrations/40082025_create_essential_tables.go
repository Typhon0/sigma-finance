package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Create essential tables ")

			// Create assets table
			_, err := db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.assets (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					name VARCHAR(255) NOT NULL,
					asset_type_id INT REFERENCES sigma_finance.asset_type(id),
					current_value DECIMAL(18,2),
					purchase_date DATE,
					purchase_price DECIMAL(18,2),
					is_tradeable BOOLEAN DEFAULT true,
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
					updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);
			`)
			if err != nil {
				fmt.Printf("assets table error: %v ", err)
			}

			// Create stock table
			_, err = db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.stock (
					asset_id UUID PRIMARY KEY REFERENCES sigma_finance.assets(id) ON DELETE CASCADE,
					ticker VARCHAR(20) NOT NULL,
					quantity DECIMAL(20,8) NOT NULL DEFAULT 0,
					buying_price DECIMAL(20,8)
				);
			`)
			if err != nil {
				fmt.Printf("stock table error: %v ", err)
			}

			// Create crypto table
			_, err = db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.crypto (
					asset_id UUID PRIMARY KEY REFERENCES sigma_finance.assets(id) ON DELETE CASCADE,
					wallet_address VARCHAR(100),
					blockchain_network VARCHAR(50),
					quantity DECIMAL(20,8) NOT NULL DEFAULT 0
				);
			`)
			if err != nil {
				fmt.Printf("crypto table error: %v ", err)
			}

			// Create positions table
			_, err = db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.positions (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					portfolio_id UUID REFERENCES sigma_finance.portfolio(id) ON DELETE CASCADE,
					asset_id UUID REFERENCES sigma_finance.assets(id) ON DELETE CASCADE,
					quantity DECIMAL(20,8) NOT NULL DEFAULT 0,
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
					updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);
			`)
			if err != nil {
				fmt.Printf("positions table error: %v ", err)
			}

			// Create transactions table (plural)
			_, err = db.ExecContext(ctx, `
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
			`)
			if err != nil {
				fmt.Printf("transactions table error: %v ", err)
			}

			// Create transaction table (singular, legacy)
			_, err = db.ExecContext(ctx, `
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
				fmt.Printf("transaction table error: %v ", err)
			}

			// Create alert table
			_, err = db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.alert (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID REFERENCES sigma_finance.user(id) ON DELETE CASCADE,
					portfolio_id UUID REFERENCES sigma_finance.portfolio(id) ON DELETE CASCADE,
					name VARCHAR(255) NOT NULL,
					alert_type VARCHAR(50) NOT NULL,
					condition_type VARCHAR(50) NOT NULL,
					threshold_value DECIMAL(20,8),
					threshold_percentage DECIMAL(5,2),
					is_active BOOLEAN DEFAULT true,
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
					updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);
			`)
			if err != nil {
				fmt.Printf("alert table error: %v ", err)
			}

			// Create alert_history table
			_, err = db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.alert_history (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					alert_id UUID REFERENCES sigma_finance.alert(id) ON DELETE CASCADE,
					triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
					current_value DECIMAL(20,8),
					message TEXT,
					acknowledged BOOLEAN DEFAULT false,
					acknowledged_at TIMESTAMP WITH TIME ZONE
				);
			`)
			if err != nil {
				fmt.Printf("alert_history table error: %v ", err)
			}

			// Create performance_snapshot table
			_, err = db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.performance_snapshot (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID REFERENCES sigma_finance.user(id) ON DELETE CASCADE,
					portfolio_id UUID REFERENCES sigma_finance.portfolio(id) ON DELETE CASCADE,
					total_value DECIMAL(18,2) NOT NULL,
					total_cost DECIMAL(18,2),
					total_return DECIMAL(18,2),
					return_percentage DECIMAL(5,2),
					time_range VARCHAR(20),
					calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);
			`)
			if err != nil {
				fmt.Printf("performance_snapshot table error: %v ", err)
			}

			fmt.Printf(" (done) ")
			return nil
		},
		func(ctx context.Context, db *bun.DB) error {
			return nil
		},
	)
}
