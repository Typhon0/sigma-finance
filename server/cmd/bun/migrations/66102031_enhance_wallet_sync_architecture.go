package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Enhance wallet sync architecture: capabilities, discovered_addresses, movement_index, blockchain_network_configs ")

			_, err := db.ExecContext(ctx, `
				-- 1. Add capability_level & discovered_addresses to wallet_accounts
				ALTER TABLE sigma_finance.wallet_accounts
				ADD COLUMN IF NOT EXISTS capability_level VARCHAR(30) NOT NULL DEFAULT 'BALANCE_ONLY',
				ADD COLUMN IF NOT EXISTS discovered_addresses JSONB;

				-- 2. Add movement_index to wallet_activities and update unique constraint
				ALTER TABLE sigma_finance.wallet_activities
				ADD COLUMN IF NOT EXISTS movement_index INT NOT NULL DEFAULT 0;

				DROP INDEX IF EXISTS sigma_finance.idx_wallet_activities_wallet_tx;
				CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_activities_wallet_tx_mvt 
				ON sigma_finance.wallet_activities(wallet_account_id, tx_hash, COALESCE(token_address, 'NATIVE'), movement_index);

				-- 3. Create blockchain_network_configs table for configurable RPC & explorer endpoints
				CREATE TABLE IF NOT EXISTS sigma_finance.blockchain_network_configs (
					network VARCHAR(50) PRIMARY KEY,
					rpc_url TEXT NOT NULL,
					explorer_api_url TEXT,
					source VARCHAR(20) NOT NULL DEFAULT 'DEFAULT',
					updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);

				-- Populate default endpoints
				INSERT INTO sigma_finance.blockchain_network_configs (network, rpc_url, explorer_api_url, source)
				VALUES
					('ETHEREUM', 'https://ethereum-rpc.publicnode.com', 'https://api.etherscan.io/api', 'DEFAULT'),
					('BASE', 'https://mainnet.base.org', 'https://base.blockscout.com/api', 'DEFAULT'),
					('ARBITRUM', 'https://arb1.arbitrum.io/rpc', 'https://arbitrum.blockscout.com/api', 'DEFAULT'),
					('OPTIMISM', 'https://mainnet.optimism.io', 'https://optimism.blockscout.com/api', 'DEFAULT'),
					('POLYGON', 'https://polygon-rpc.com', 'https://api.polygonscan.com/api', 'DEFAULT'),
					('SOLANA', 'https://api.mainnet-beta.solana.com', NULL, 'DEFAULT'),
					('BITCOIN', 'https://mempool.space/api', 'https://blockstream.info/api', 'DEFAULT')
				ON CONFLICT (network) DO NOTHING;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Rollback enhanced wallet sync architecture ")

			_, err := db.ExecContext(ctx, `
				DROP TABLE IF EXISTS sigma_finance.blockchain_network_configs;

				DROP INDEX IF EXISTS sigma_finance.idx_wallet_activities_wallet_tx_mvt;
				CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_activities_wallet_tx 
				ON sigma_finance.wallet_activities(wallet_account_id, tx_hash, COALESCE(token_address, 'NATIVE'));

				ALTER TABLE sigma_finance.wallet_activities
				DROP COLUMN IF EXISTS movement_index;

				ALTER TABLE sigma_finance.wallet_accounts
				DROP COLUMN IF EXISTS capability_level,
				DROP COLUMN IF EXISTS discovered_addresses;
			`)
			return err
		},
	)
}

