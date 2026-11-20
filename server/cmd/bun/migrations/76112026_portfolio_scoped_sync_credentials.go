package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(func(ctx context.Context, db *bun.DB) error {
		fmt.Print(" [up migration] add portfolio_id to sync_credentials and relax connection unique constraint...")
		_, err := db.ExecContext(ctx, `
			-- 1. Add portfolio_id column to sync_credentials
			ALTER TABLE sigma_finance.sync_credentials
				ADD COLUMN IF NOT EXISTS portfolio_id UUID REFERENCES sigma_finance.portfolio(id) ON DELETE CASCADE;

			CREATE INDEX IF NOT EXISTS idx_sync_credentials_portfolio_id
				ON sigma_finance.sync_credentials(portfolio_id);

			-- 2. Drop old single-user-provider constraint and replace with portfolio-scoped and global indexes
			DROP INDEX IF EXISTS sigma_finance.idx_sync_credentials_user_provider;

			CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_credentials_user_portfolio_provider
				ON sigma_finance.sync_credentials(user_id, portfolio_id, provider)
				WHERE portfolio_id IS NOT NULL;

			CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_credentials_user_provider_global
				ON sigma_finance.sync_credentials(user_id, provider)
				WHERE user_id IS NOT NULL AND portfolio_id IS NULL;

			-- 3. Replace credential-scoped connection unique constraint with portfolio-scoped external account constraint
			DROP INDEX IF EXISTS sigma_finance.idx_sync_connections_cred_ext_acc;

			CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_connections_portfolio_ext_acc
				ON sigma_finance.sync_connections(portfolio_id, external_account_id);
		`)
		return err
	}, func(ctx context.Context, db *bun.DB) error {
		fmt.Print(" [down migration] revert portfolio-scoped sync credentials...")
		_, err := db.ExecContext(ctx, `
			DROP INDEX IF EXISTS sigma_finance.idx_sync_connections_portfolio_ext_acc;
			CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_connections_cred_ext_acc
				ON sigma_finance.sync_connections(credential_id, external_account_id);

			DROP INDEX IF EXISTS sigma_finance.idx_sync_credentials_user_provider_global;
			DROP INDEX IF EXISTS sigma_finance.idx_sync_credentials_user_portfolio_provider;
			CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_credentials_user_provider
				ON sigma_finance.sync_credentials(user_id, provider) WHERE user_id IS NOT NULL;

			DROP INDEX IF EXISTS sigma_finance.idx_sync_credentials_portfolio_id;
			ALTER TABLE sigma_finance.sync_credentials DROP COLUMN IF EXISTS portfolio_id;
		`)
		return err
	})
}
