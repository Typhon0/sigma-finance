package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Create sync_auth_sessions table ")

			_, err := db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.sync_auth_sessions (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					user_id UUID NOT NULL REFERENCES sigma_finance."user"(id) ON DELETE CASCADE,
					portfolio_id UUID NOT NULL REFERENCES sigma_finance.portfolio(id) ON DELETE CASCADE,
					provider VARCHAR(50) NOT NULL,
					status VARCHAR(30) NOT NULL DEFAULT 'WAITING_FOR_CONFIRMATION',
					encrypted_process_info TEXT NOT NULL,
					expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
					updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);

				CREATE INDEX IF NOT EXISTS idx_sync_auth_sessions_user_id ON sigma_finance.sync_auth_sessions(user_id);
				CREATE INDEX IF NOT EXISTS idx_sync_auth_sessions_provider_status ON sigma_finance.sync_auth_sessions(provider, status);
				CREATE INDEX IF NOT EXISTS idx_sync_auth_sessions_expires_at ON sigma_finance.sync_auth_sessions(expires_at);

				-- Enhance sync_connections with cash_account_id and metadata for cursor persistence
				ALTER TABLE sigma_finance.sync_connections
					ADD COLUMN IF NOT EXISTS cash_account_id VARCHAR(255),
					ADD COLUMN IF NOT EXISTS metadata JSONB;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Drop sync_auth_sessions table ")

			_, err := db.ExecContext(ctx, `
				DROP TABLE IF EXISTS sigma_finance.sync_auth_sessions CASCADE;
			`)
			return err
		},
	)
}
