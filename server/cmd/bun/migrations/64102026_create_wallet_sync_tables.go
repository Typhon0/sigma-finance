package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Create wallet sync schema (wallet_devices, wallet_accounts, wallet_balances, wallet_activities, wallet_activity_reviews, wallet_cu_tracking) ")

			_, err := db.ExecContext(ctx, `
				-- 1. Optional Parent Container (for Hardware / Multi-Chain Wallets like Ledger, Trezor, Phantom)
				CREATE TABLE IF NOT EXISTS sigma_finance.wallet_devices (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID NOT NULL REFERENCES sigma_finance."user"(id) ON DELETE CASCADE,
					name VARCHAR(100) NOT NULL,
					device_type VARCHAR(50) NOT NULL DEFAULT 'SOFTWARE',
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
					updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);

				CREATE INDEX IF NOT EXISTS idx_wallet_devices_user_id ON sigma_finance.wallet_devices(user_id);

				-- 2. Wallet Accounts (One per chain address or xpub)
				CREATE TABLE IF NOT EXISTS sigma_finance.wallet_accounts (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID NOT NULL REFERENCES sigma_finance."user"(id) ON DELETE CASCADE,
					device_id UUID REFERENCES sigma_finance.wallet_devices(id) ON DELETE SET NULL,
					account_id UUID REFERENCES sigma_finance.accounts(id) ON DELETE SET NULL,
					network VARCHAR(50) NOT NULL,
					address_or_xpub VARCHAR(255) NOT NULL,
					is_xpub BOOLEAN NOT NULL DEFAULT FALSE,
					label VARCHAR(100),
					is_active BOOLEAN NOT NULL DEFAULT TRUE,
					last_sync_at TIMESTAMP WITH TIME ZONE,
					sync_cursor VARCHAR(255),
					history_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
					last_sync_error TEXT,
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
					updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);

				CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user_id ON sigma_finance.wallet_accounts(user_id);
				CREATE INDEX IF NOT EXISTS idx_wallet_accounts_device_id ON sigma_finance.wallet_accounts(device_id);
				CREATE INDEX IF NOT EXISTS idx_wallet_accounts_account_id ON sigma_finance.wallet_accounts(account_id);
				CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_accounts_user_net_addr ON sigma_finance.wallet_accounts(user_id, network, address_or_xpub);

				-- 3. Dedicated Wallet Balances (Exact uint256 / 78-digit precision + Spam Shelf)
				CREATE TABLE IF NOT EXISTS sigma_finance.wallet_balances (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					wallet_account_id UUID NOT NULL REFERENCES sigma_finance.wallet_accounts(id) ON DELETE CASCADE,
					instrument_id UUID REFERENCES sigma_finance.instruments(id) ON DELETE SET NULL,
					asset_id UUID REFERENCES sigma_finance.assets(id) ON DELETE SET NULL,
					token_address VARCHAR(255),
					symbol VARCHAR(50) NOT NULL,
					name VARCHAR(255),
					decimals INT NOT NULL DEFAULT 18,
					raw_balance NUMERIC(78, 0) NOT NULL DEFAULT 0,
					formatted_quantity DECIMAL(36, 18) NOT NULL DEFAULT 0,
					is_spam BOOLEAN NOT NULL DEFAULT FALSE,
					is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
					is_stale BOOLEAN NOT NULL DEFAULT FALSE,
					last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);

				CREATE INDEX IF NOT EXISTS idx_wallet_balances_account_id ON sigma_finance.wallet_balances(wallet_account_id);
				CREATE INDEX IF NOT EXISTS idx_wallet_balances_instrument_id ON sigma_finance.wallet_balances(instrument_id);
				CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_balances_wallet_token ON sigma_finance.wallet_balances(wallet_account_id, COALESCE(token_address, 'NATIVE'));

				-- 4. Dedicated Raw Activities (with Internal Transfer link)
				CREATE TABLE IF NOT EXISTS sigma_finance.wallet_activities (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					wallet_account_id UUID NOT NULL REFERENCES sigma_finance.wallet_accounts(id) ON DELETE CASCADE,
					tx_hash VARCHAR(255) NOT NULL,
					block_or_slot BIGINT NOT NULL,
					executed_at TIMESTAMP WITH TIME ZONE NOT NULL,
					from_address VARCHAR(255) NOT NULL,
					to_address VARCHAR(255) NOT NULL,
					token_address VARCHAR(255),
					raw_amount NUMERIC(78, 0) NOT NULL DEFAULT 0,
					decimals INT NOT NULL DEFAULT 18,
					formatted_amount DECIMAL(36, 18) NOT NULL DEFAULT 0,
					fee_amount NUMERIC(78, 0) NOT NULL DEFAULT 0,
					provider_source VARCHAR(50) NOT NULL DEFAULT 'ALCHEMY',
					raw_metadata JSONB,
					matched_internal_activity_id UUID REFERENCES sigma_finance.wallet_activities(id) ON DELETE SET NULL,
					classified_transaction_id UUID REFERENCES sigma_finance.transactions(id) ON DELETE SET NULL,
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);

				CREATE INDEX IF NOT EXISTS idx_wallet_activities_account_id ON sigma_finance.wallet_activities(wallet_account_id);
				CREATE INDEX IF NOT EXISTS idx_wallet_activities_executed_at ON sigma_finance.wallet_activities(executed_at DESC);
				CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_activities_wallet_tx ON sigma_finance.wallet_activities(wallet_account_id, tx_hash, COALESCE(token_address, 'NATIVE'));

				-- 5. Staging Review Queue for Complex DeFi Transactions
				CREATE TABLE IF NOT EXISTS sigma_finance.wallet_activity_reviews (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					wallet_activity_id UUID NOT NULL REFERENCES sigma_finance.wallet_activities(id) ON DELETE CASCADE,
					user_id UUID NOT NULL REFERENCES sigma_finance."user"(id) ON DELETE CASCADE,
					review_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
					suggested_type VARCHAR(30) NOT NULL,
					notes TEXT,
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
					updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);

				CREATE INDEX IF NOT EXISTS idx_wallet_activity_reviews_user_status ON sigma_finance.wallet_activity_reviews(user_id, review_status);

				-- 6. Compute Unit (CU) Quota Meter Table
				CREATE TABLE IF NOT EXISTS sigma_finance.wallet_cu_tracking (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					billing_month VARCHAR(7) NOT NULL,
					compute_units_consumed BIGINT NOT NULL DEFAULT 0,
					is_throttled BOOLEAN NOT NULL DEFAULT FALSE,
					updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);

				CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_cu_billing_month ON sigma_finance.wallet_cu_tracking(billing_month);
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Drop wallet sync schema ")
			_, err := db.ExecContext(ctx, `
				DROP TABLE IF EXISTS sigma_finance.wallet_activity_reviews CASCADE;
				DROP TABLE IF EXISTS sigma_finance.wallet_activities CASCADE;
				DROP TABLE IF EXISTS sigma_finance.wallet_balances CASCADE;
				DROP TABLE IF EXISTS sigma_finance.wallet_accounts CASCADE;
				DROP TABLE IF EXISTS sigma_finance.wallet_devices CASCADE;
				DROP TABLE IF EXISTS sigma_finance.wallet_cu_tracking CASCADE;
			`)
			return err
		},
	)
}
