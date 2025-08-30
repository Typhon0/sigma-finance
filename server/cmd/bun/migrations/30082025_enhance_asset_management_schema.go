package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Enhance asset management schema ")
			_, err := db.ExecContext(ctx, `
				-- First, migrate portfolio table to use UUID IDs
				ALTER TABLE sigma_finance.portfolio ADD COLUMN IF NOT EXISTS id_new UUID DEFAULT gen_random_uuid();
				UPDATE sigma_finance.portfolio SET id_new = gen_random_uuid() WHERE id_new IS NULL;

				-- Update portfolio_asset table to use new UUID references
				ALTER TABLE sigma_finance.portfolio_asset ADD COLUMN IF NOT EXISTS portfolio_id_new UUID;
				UPDATE sigma_finance.portfolio_asset 
				SET portfolio_id_new = p.id_new 
				FROM sigma_finance.portfolio p 
				WHERE sigma_finance.portfolio_asset.portfolio_id = p.id;

				-- Drop old foreign key constraints
				ALTER TABLE sigma_finance.portfolio_asset DROP CONSTRAINT IF EXISTS portfolio_asset_portfolio_id_fkey;

				-- Drop old columns and rename new ones
				ALTER TABLE sigma_finance.portfolio DROP CONSTRAINT IF EXISTS portfolio_pkey CASCADE;
				ALTER TABLE sigma_finance.portfolio DROP COLUMN IF EXISTS id;
				ALTER TABLE sigma_finance.portfolio RENAME COLUMN id_new TO id;
				ALTER TABLE sigma_finance.portfolio ADD PRIMARY KEY (id);

				ALTER TABLE sigma_finance.portfolio_asset DROP COLUMN IF EXISTS portfolio_id;
				ALTER TABLE sigma_finance.portfolio_asset RENAME COLUMN portfolio_id_new TO portfolio_id;
				ALTER TABLE sigma_finance.portfolio_asset ALTER COLUMN portfolio_id SET NOT NULL;

				-- Add new foreign key constraint
				ALTER TABLE sigma_finance.portfolio_asset ADD CONSTRAINT portfolio_asset_portfolio_id_fkey 
					FOREIGN KEY (portfolio_id) REFERENCES sigma_finance.portfolio(id) ON DELETE CASCADE;

				-- Create asset type enumeration
				CREATE TYPE asset_type AS ENUM (
					'STOCK',
					'CRYPTO',
					'BANK_ACCOUNT',
					'REAL_ESTATE',
					'LIFE_INSURANCE',
					'WATCH',
					'OTHER_VALUABLE'
				);

				-- Create transaction type enumeration
				CREATE TYPE transaction_type AS ENUM (
					'BUY',
					'SELL',
					'DEPOSIT',
					'WITHDRAWAL',
					'TRANSFER_IN',
					'TRANSFER_OUT',
					'DIVIDEND',
					'INTEREST',
					'FEE',
					'ADJUSTMENT'
				);

				-- Create alert type enumeration
				CREATE TYPE alert_type AS ENUM (
					'PRICE',
					'PERCENTAGE_CHANGE',
					'PORTFOLIO_VALUE',
					'ALLOCATION'
				);

				-- Create condition type enumeration
				CREATE TYPE condition_type AS ENUM (
					'ABOVE',
					'BELOW',
					'INCREASE_BY',
					'DECREASE_BY'
				);

				-- Enhanced Assets table with flexible metadata
				CREATE TABLE IF NOT EXISTS sigma_finance.assets (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					type asset_type NOT NULL,
					symbol VARCHAR(50), -- For tradeable assets
					name VARCHAR(255) NOT NULL,
					description TEXT,
					metadata JSONB, -- Asset-specific data
					is_tradeable BOOLEAN DEFAULT false,
					market_data_source VARCHAR(100), -- API source for price data
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
					updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
					
					-- Constraints
				);

				-- Add partial unique constraint for tradeable symbols
				CREATE UNIQUE INDEX IF NOT EXISTS unique_tradeable_symbol 
					ON sigma_finance.assets (symbol) WHERE is_tradeable = true;

				-- Enhanced Positions table
				CREATE TABLE IF NOT EXISTS sigma_finance.positions (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					portfolio_id UUID NOT NULL REFERENCES sigma_finance.portfolio(id) ON DELETE CASCADE,
					asset_id UUID NOT NULL REFERENCES sigma_finance.assets(id) ON DELETE CASCADE,
					quantity DECIMAL(20,8) NOT NULL DEFAULT 0,
					ownership_percentage DECIMAL(5,2) DEFAULT 100.00,
					average_cost_basis DECIMAL(20,8), -- Cost per unit
					total_cost_basis BIGINT, -- Total cost in cents
					notes TEXT,
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
					updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
					
					-- Constraints
					CONSTRAINT unique_portfolio_asset UNIQUE (portfolio_id, asset_id),
					CONSTRAINT valid_ownership_pct CHECK (ownership_percentage > 0 AND ownership_percentage <= 100),
					CONSTRAINT valid_quantity CHECK (quantity >= 0)
				);

				-- Enhanced Transactions table
				CREATE TABLE IF NOT EXISTS sigma_finance.transactions (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID NOT NULL REFERENCES sigma_finance.user(id) ON DELETE CASCADE,
					position_id UUID REFERENCES sigma_finance.positions(id) ON DELETE CASCADE,
					type transaction_type NOT NULL,
					amount BIGINT NOT NULL, -- Amount in cents
					quantity DECIMAL(20,8), -- For quantity-based transactions
					price_per_unit DECIMAL(20,8), -- Price at transaction time
					fee BIGINT DEFAULT 0, -- Transaction fee in cents
					notes TEXT,
					transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
					
					-- Constraints
					CONSTRAINT valid_amount CHECK (amount != 0)
				);

				-- Price history for tradeable assets (optimized for time-series queries)
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices (
					id BIGINT GENERATED ALWAYS AS IDENTITY,
					asset_id UUID NOT NULL REFERENCES sigma_finance.assets(id) ON DELETE CASCADE,
					price DECIMAL(20,8) NOT NULL,
					volume BIGINT,
					market_cap BIGINT,
					timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
					source VARCHAR(100) NOT NULL,
					
					-- Constraints
					CONSTRAINT valid_price CHECK (price > 0),
					PRIMARY KEY (id, timestamp)
				) PARTITION BY RANGE (timestamp);

				-- Create monthly partitions for 2025
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2025_01 PARTITION OF sigma_finance.asset_prices
					FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2025_02 PARTITION OF sigma_finance.asset_prices
					FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2025_03 PARTITION OF sigma_finance.asset_prices
					FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2025_04 PARTITION OF sigma_finance.asset_prices
					FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2025_05 PARTITION OF sigma_finance.asset_prices
					FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2025_06 PARTITION OF sigma_finance.asset_prices
					FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2025_07 PARTITION OF sigma_finance.asset_prices
					FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2025_08 PARTITION OF sigma_finance.asset_prices
					FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2025_09 PARTITION OF sigma_finance.asset_prices
					FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2025_10 PARTITION OF sigma_finance.asset_prices
					FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2025_11 PARTITION OF sigma_finance.asset_prices
					FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2025_12 PARTITION OF sigma_finance.asset_prices
					FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

				-- Portfolio performance snapshots (daily aggregation)
				CREATE TABLE IF NOT EXISTS sigma_finance.portfolio_performance (
					id BIGSERIAL PRIMARY KEY,
					portfolio_id UUID NOT NULL REFERENCES sigma_finance.portfolio(id) ON DELETE CASCADE,
					total_value BIGINT NOT NULL, -- Total portfolio value in cents
					total_cost_basis BIGINT NOT NULL, -- Total cost basis in cents
					unrealized_gain_loss BIGINT NOT NULL, -- Unrealized P&L in cents
					realized_gain_loss BIGINT NOT NULL, -- Realized P&L in cents
					return_percentage DECIMAL(10,4), -- Total return percentage
					snapshot_date DATE NOT NULL,
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
					
					-- Constraints
					CONSTRAINT unique_portfolio_date UNIQUE (portfolio_id, snapshot_date)
				);

				-- Asset allocation snapshots
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_allocations (
					id BIGSERIAL PRIMARY KEY,
					portfolio_id UUID NOT NULL REFERENCES sigma_finance.portfolio(id) ON DELETE CASCADE,
					asset_type asset_type NOT NULL,
					value BIGINT NOT NULL, -- Value in cents
					percentage DECIMAL(5,2) NOT NULL, -- Percentage of portfolio
					position_count INTEGER NOT NULL,
					snapshot_date DATE NOT NULL,
					
					-- Constraints
					CONSTRAINT unique_portfolio_type_date UNIQUE (portfolio_id, asset_type, snapshot_date)
				);

				-- User alerts configuration
				CREATE TABLE IF NOT EXISTS sigma_finance.user_alerts (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID NOT NULL REFERENCES sigma_finance.user(id) ON DELETE CASCADE,
					asset_id UUID REFERENCES sigma_finance.assets(id) ON DELETE CASCADE,
					portfolio_id UUID REFERENCES sigma_finance.portfolio(id) ON DELETE CASCADE,
					alert_type alert_type NOT NULL,
					condition_type condition_type NOT NULL,
					threshold_value DECIMAL(20,8),
					threshold_percentage DECIMAL(5,2),
					is_active BOOLEAN DEFAULT true,
					last_triggered TIMESTAMP WITH TIME ZONE,
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);

				-- Performance indexes for asset queries
				CREATE INDEX IF NOT EXISTS idx_assets_type ON sigma_finance.assets(type);
				CREATE INDEX IF NOT EXISTS idx_assets_symbol ON sigma_finance.assets(symbol) WHERE symbol IS NOT NULL;
				CREATE INDEX IF NOT EXISTS idx_assets_tradeable ON sigma_finance.assets(is_tradeable) WHERE is_tradeable = true;
				CREATE INDEX IF NOT EXISTS idx_assets_metadata_gin ON sigma_finance.assets USING GIN(metadata);

				-- Performance indexes for position queries
				CREATE INDEX IF NOT EXISTS idx_positions_portfolio ON sigma_finance.positions(portfolio_id);
				CREATE INDEX IF NOT EXISTS idx_positions_asset ON sigma_finance.positions(asset_id);
				CREATE INDEX IF NOT EXISTS idx_positions_updated ON sigma_finance.positions(updated_at);

				-- Performance indexes for transaction queries
				CREATE INDEX IF NOT EXISTS idx_transactions_user ON sigma_finance.transactions(user_id);
				CREATE INDEX IF NOT EXISTS idx_transactions_position ON sigma_finance.transactions(position_id);
				CREATE INDEX IF NOT EXISTS idx_transactions_date ON sigma_finance.transactions(transaction_date);
				CREATE INDEX IF NOT EXISTS idx_transactions_type ON sigma_finance.transactions(type);

				-- Performance indexes for price history (time-series optimized)
				CREATE INDEX IF NOT EXISTS idx_asset_prices_asset_time ON sigma_finance.asset_prices(asset_id, timestamp DESC);
				CREATE INDEX IF NOT EXISTS idx_asset_prices_timestamp ON sigma_finance.asset_prices(timestamp);

				-- Performance indexes for performance queries
				CREATE INDEX IF NOT EXISTS idx_portfolio_performance_portfolio_date ON sigma_finance.portfolio_performance(portfolio_id, snapshot_date DESC);
				CREATE INDEX IF NOT EXISTS idx_asset_allocations_portfolio_date ON sigma_finance.asset_allocations(portfolio_id, snapshot_date DESC);

				-- Performance indexes for alert queries
				CREATE INDEX IF NOT EXISTS idx_user_alerts_user_active ON sigma_finance.user_alerts(user_id) WHERE is_active = true;
				CREATE INDEX IF NOT EXISTS idx_user_alerts_asset ON sigma_finance.user_alerts(asset_id) WHERE asset_id IS NOT NULL;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Drop enhanced asset management schema ")
			_, err := db.ExecContext(ctx, `
				-- Drop indexes
				DROP INDEX IF EXISTS sigma_finance.unique_tradeable_symbol;
				DROP INDEX IF EXISTS sigma_finance.idx_user_alerts_asset;
				DROP INDEX IF EXISTS sigma_finance.idx_user_alerts_user_active;
				DROP INDEX IF EXISTS sigma_finance.idx_asset_allocations_portfolio_date;
				DROP INDEX IF EXISTS sigma_finance.idx_portfolio_performance_portfolio_date;
				DROP INDEX IF EXISTS sigma_finance.idx_asset_prices_timestamp;
				DROP INDEX IF EXISTS sigma_finance.idx_asset_prices_asset_time;
				DROP INDEX IF EXISTS sigma_finance.idx_transactions_type;
				DROP INDEX IF EXISTS sigma_finance.idx_transactions_date;
				DROP INDEX IF EXISTS sigma_finance.idx_transactions_position;
				DROP INDEX IF EXISTS sigma_finance.idx_transactions_user;
				DROP INDEX IF EXISTS sigma_finance.idx_positions_updated;
				DROP INDEX IF EXISTS sigma_finance.idx_positions_asset;
				DROP INDEX IF EXISTS sigma_finance.idx_positions_portfolio;
				DROP INDEX IF EXISTS sigma_finance.idx_assets_metadata_gin;
				DROP INDEX IF EXISTS sigma_finance.idx_assets_tradeable;
				DROP INDEX IF EXISTS sigma_finance.idx_assets_symbol;
				DROP INDEX IF EXISTS sigma_finance.idx_assets_type;

				-- Drop tables
				DROP TABLE IF EXISTS sigma_finance.user_alerts;
				DROP TABLE IF EXISTS sigma_finance.asset_allocations;
				DROP TABLE IF EXISTS sigma_finance.portfolio_performance;
				DROP TABLE IF EXISTS sigma_finance.asset_prices;
				DROP TABLE IF EXISTS sigma_finance.transactions;
				DROP TABLE IF EXISTS sigma_finance.positions;
				DROP TABLE IF EXISTS sigma_finance.assets;

				-- Drop enums
				DROP TYPE IF EXISTS condition_type;
				DROP TYPE IF EXISTS alert_type;
				DROP TYPE IF EXISTS transaction_type;
				DROP TYPE IF EXISTS asset_type;

				-- Revert portfolio table to use integer IDs (data loss scenario)
				-- Add integer ID column
				ALTER TABLE sigma_finance.portfolio ADD COLUMN id_int SERIAL;
				
				-- Update portfolio_asset references
				ALTER TABLE sigma_finance.portfolio_asset ADD COLUMN portfolio_id_int INT;
				UPDATE sigma_finance.portfolio_asset 
				SET portfolio_id_int = p.id_int 
				FROM sigma_finance.portfolio p 
				WHERE sigma_finance.portfolio_asset.portfolio_id = p.id;

				-- Drop foreign key constraints
				ALTER TABLE sigma_finance.portfolio_asset DROP CONSTRAINT IF EXISTS portfolio_asset_portfolio_id_fkey;

				-- Drop UUID columns and rename integer columns
				ALTER TABLE sigma_finance.portfolio DROP CONSTRAINT IF EXISTS portfolio_pkey CASCADE;
				ALTER TABLE sigma_finance.portfolio DROP COLUMN IF EXISTS id;
				ALTER TABLE sigma_finance.portfolio RENAME COLUMN id_int TO id;
				ALTER TABLE sigma_finance.portfolio ADD PRIMARY KEY (id);

				ALTER TABLE sigma_finance.portfolio_asset DROP COLUMN IF EXISTS portfolio_id;
				ALTER TABLE sigma_finance.portfolio_asset RENAME COLUMN portfolio_id_int TO portfolio_id;
				ALTER TABLE sigma_finance.portfolio_asset ALTER COLUMN portfolio_id SET NOT NULL;

				-- Add foreign key constraint back
				ALTER TABLE sigma_finance.portfolio_asset ADD CONSTRAINT portfolio_asset_portfolio_id_fkey 
					FOREIGN KEY (portfolio_id) REFERENCES sigma_finance.portfolio(id) ON DELETE CASCADE;
			`)
			return err
		},
	)
}
