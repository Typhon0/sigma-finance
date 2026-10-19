package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Create accounts table, link positions to accounts, and add account_id to transactions ")

			_, err := db.ExecContext(ctx, `
				-- 1. Create accounts table
				CREATE TABLE IF NOT EXISTS sigma_finance.accounts (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID NOT NULL REFERENCES sigma_finance."user"(id) ON DELETE CASCADE,
					portfolio_id UUID NOT NULL REFERENCES sigma_finance.portfolio(id) ON DELETE CASCADE,
					name VARCHAR(255) NOT NULL,
					type VARCHAR(50) NOT NULL DEFAULT 'BROKER',
					tax_wrapper VARCHAR(30) NOT NULL DEFAULT 'STANDARD_TAXABLE',
					institution VARCHAR(255),
					account_number VARCHAR(100),
					currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
					sync_provider VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
					external_id VARCHAR(255),
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
					updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);

				CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON sigma_finance.accounts(user_id);
				CREATE INDEX IF NOT EXISTS idx_accounts_portfolio_id ON sigma_finance.accounts(portfolio_id);

				-- 2. Create default 'Compte Principal' for each existing portfolio
				INSERT INTO sigma_finance.accounts (id, user_id, portfolio_id, name, type, tax_wrapper, currency, sync_provider, created_at, updated_at)
				SELECT gen_random_uuid(), p.user_id, p.id, 'Compte Principal', 'BROKER', COALESCE(p.tax_wrapper, 'STANDARD_TAXABLE'), 'EUR', 'MANUAL', NOW(), NOW()
				FROM sigma_finance.portfolio p
				WHERE NOT EXISTS (
					SELECT 1 FROM sigma_finance.accounts a WHERE a.portfolio_id = p.id
				);

				-- 3. Add account_id to positions and backfill
				ALTER TABLE sigma_finance.positions
					ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES sigma_finance.accounts(id) ON DELETE CASCADE;

				UPDATE sigma_finance.positions pos
				SET account_id = (
					SELECT a.id FROM sigma_finance.accounts a
					WHERE a.portfolio_id = pos.portfolio_id
					ORDER BY a.created_at ASC
					LIMIT 1
				)
				WHERE pos.account_id IS NULL;

				-- Enforce NOT NULL on account_id
				ALTER TABLE sigma_finance.positions
					ALTER COLUMN account_id SET NOT NULL;

				-- Replace UNIQUE(portfolio_id, asset_id) with UNIQUE(account_id, asset_id)
				ALTER TABLE sigma_finance.positions
					DROP CONSTRAINT IF EXISTS unique_portfolio_asset;

				ALTER TABLE sigma_finance.positions
					ADD CONSTRAINT unique_account_asset UNIQUE (account_id, asset_id);

				CREATE INDEX IF NOT EXISTS idx_positions_account_id ON sigma_finance.positions(account_id);

				-- 4. Add account_id to transactions and backfill from position
				ALTER TABLE sigma_finance.transactions
					ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES sigma_finance.accounts(id) ON DELETE SET NULL;

				UPDATE sigma_finance.transactions tx
				SET account_id = pos.account_id
				FROM sigma_finance.positions pos
				WHERE tx.position_id = pos.id AND tx.account_id IS NULL;

				CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON sigma_finance.transactions(account_id);

				COMMENT ON TABLE sigma_finance.accounts IS
					'Financial custody/legal accounts (Trade Republic CTO, Fortuneo PEA, Binance...) held under a Portfolio';
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Revert accounts table, restore portfolio uniqueness on positions ")

			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.transactions
					DROP COLUMN IF EXISTS account_id;

				ALTER TABLE sigma_finance.positions
					DROP CONSTRAINT IF EXISTS unique_account_asset;

				ALTER TABLE sigma_finance.positions
					DROP COLUMN IF EXISTS account_id;

				ALTER TABLE sigma_finance.positions
					ADD CONSTRAINT unique_portfolio_asset UNIQUE (portfolio_id, asset_id);

				DROP TABLE IF EXISTS sigma_finance.accounts CASCADE;
			`)
			return err
		},
	)
}
