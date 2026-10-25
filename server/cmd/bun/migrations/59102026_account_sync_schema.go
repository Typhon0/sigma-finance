package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Create account sync schema (sync_credentials, sync_connections, sync_runs, and transaction external_id) ")

			_, err := db.ExecContext(ctx, `
				-- 1. Create sync_credentials table
				CREATE TABLE IF NOT EXISTS sigma_finance.sync_credentials (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID REFERENCES sigma_finance."user"(id) ON DELETE CASCADE,
					is_system BOOLEAN NOT NULL DEFAULT FALSE,
					provider VARCHAR(50) NOT NULL,
					encrypted_data TEXT NOT NULL,
					status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
					updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);

				CREATE INDEX IF NOT EXISTS idx_sync_credentials_user_id ON sigma_finance.sync_credentials(user_id);
				CREATE INDEX IF NOT EXISTS idx_sync_credentials_provider ON sigma_finance.sync_credentials(provider);
				CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_credentials_user_provider ON sigma_finance.sync_credentials(user_id, provider) WHERE user_id IS NOT NULL;
				CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_credentials_system_provider ON sigma_finance.sync_credentials(provider) WHERE is_system = true AND user_id IS NULL;

				-- 2. Create sync_connections table
				CREATE TABLE IF NOT EXISTS sigma_finance.sync_connections (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID NOT NULL REFERENCES sigma_finance."user"(id) ON DELETE CASCADE,
					portfolio_id UUID NOT NULL REFERENCES sigma_finance.portfolio(id) ON DELETE CASCADE,
					credential_id UUID NOT NULL REFERENCES sigma_finance.sync_credentials(id) ON DELETE CASCADE,
					account_id UUID REFERENCES sigma_finance.accounts(id) ON DELETE SET NULL,
					provider VARCHAR(50) NOT NULL,
					external_institution_id VARCHAR(100) NOT NULL,
					external_account_id VARCHAR(255) NOT NULL,
					institution_name VARCHAR(255) NOT NULL,
					sync_status VARCHAR(30) NOT NULL DEFAULT 'IDLE',
					last_sync_at TIMESTAMP WITH TIME ZONE,
					last_error TEXT,
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
					updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);

				CREATE INDEX IF NOT EXISTS idx_sync_connections_user_id ON sigma_finance.sync_connections(user_id);
				CREATE INDEX IF NOT EXISTS idx_sync_connections_portfolio_id ON sigma_finance.sync_connections(portfolio_id);
				CREATE INDEX IF NOT EXISTS idx_sync_connections_credential_id ON sigma_finance.sync_connections(credential_id);
				CREATE INDEX IF NOT EXISTS idx_sync_connections_account_id ON sigma_finance.sync_connections(account_id);
				CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_connections_cred_ext_acc ON sigma_finance.sync_connections(credential_id, external_account_id);

				-- 3. Create sync_runs table
				CREATE TABLE IF NOT EXISTS sigma_finance.sync_runs (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					connection_id UUID NOT NULL REFERENCES sigma_finance.sync_connections(id) ON DELETE CASCADE,
					status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS',
					items_imported INTEGER NOT NULL DEFAULT 0,
					items_updated INTEGER NOT NULL DEFAULT 0,
					error_message TEXT,
					started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
					completed_at TIMESTAMP WITH TIME ZONE
				);

				CREATE INDEX IF NOT EXISTS idx_sync_runs_connection_id ON sigma_finance.sync_runs(connection_id);
				CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at ON sigma_finance.sync_runs(started_at DESC);

				-- 4. Ensure accounts table has sync columns and index
				DO $$
				BEGIN
					IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sigma_finance' AND table_name = 'accounts') THEN
						ALTER TABLE sigma_finance.accounts ADD COLUMN IF NOT EXISTS sync_provider VARCHAR(50) NOT NULL DEFAULT 'MANUAL';
						ALTER TABLE sigma_finance.accounts ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
						CREATE INDEX IF NOT EXISTS idx_accounts_sync_provider_external_id ON sigma_finance.accounts (sync_provider, external_id) WHERE external_id IS NOT NULL;
					END IF;
				END $$;

				-- 5. Add external_id to transactions with unique index
				ALTER TABLE sigma_finance.transactions
					ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);

				CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_account_external_id
					ON sigma_finance.transactions (account_id, external_id)
					WHERE external_id IS NOT NULL;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Drop account sync schema ")

			_, err := db.ExecContext(ctx, `
				DROP INDEX IF EXISTS sigma_finance.idx_transactions_account_external_id;
				ALTER TABLE sigma_finance.transactions DROP COLUMN IF EXISTS external_id;
				DROP INDEX IF EXISTS sigma_finance.idx_accounts_sync_provider_external_id;
				DROP TABLE IF EXISTS sigma_finance.sync_runs CASCADE;
				DROP TABLE IF EXISTS sigma_finance.sync_connections CASCADE;
				DROP TABLE IF EXISTS sigma_finance.sync_credentials CASCADE;
			`)
			return err
		},
	)
}
