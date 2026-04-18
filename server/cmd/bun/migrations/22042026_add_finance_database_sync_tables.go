package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add finance database sync tables ")
			_, err := db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.finance_database_sync_settings (
					asset_type VARCHAR(32) PRIMARY KEY,
					is_enabled BOOLEAN NOT NULL DEFAULT true,
					last_synced_at TIMESTAMP WITH TIME ZONE,
					record_count INTEGER NOT NULL DEFAULT 0,
					sync_status VARCHAR(20) NOT NULL DEFAULT 'IDLE',
					progress INTEGER NOT NULL DEFAULT 0,
					current_record TEXT,
					error_message TEXT,
					created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
					updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
				);

				CREATE TABLE IF NOT EXISTS sigma_finance.finance_database_sync_history (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					asset_type VARCHAR(32) NOT NULL,
					timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
					record_count INTEGER NOT NULL DEFAULT 0,
					status VARCHAR(20) NOT NULL,
					error_message TEXT,
					created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
				);

				CREATE INDEX IF NOT EXISTS finance_database_sync_history_timestamp_idx
					ON sigma_finance.finance_database_sync_history(timestamp DESC);
				CREATE INDEX IF NOT EXISTS finance_database_sync_history_asset_type_idx
					ON sigma_finance.finance_database_sync_history(asset_type);
			`)
			if err != nil {
				fmt.Printf(" (failed - %v) ", err)
				return err
			}
			fmt.Print(" (ok) ")
			return nil
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] ")
			_, err := db.ExecContext(ctx, `
				DROP INDEX IF EXISTS sigma_finance.finance_database_sync_history_asset_type_idx;
				DROP INDEX IF EXISTS sigma_finance.finance_database_sync_history_timestamp_idx;
				DROP TABLE IF EXISTS sigma_finance.finance_database_sync_history;
				DROP TABLE IF EXISTS sigma_finance.finance_database_sync_settings;
			`)
			if err != nil {
				fmt.Printf(" (failed - %v) ", err)
				return err
			}
			fmt.Print(" (ok) ")
			return nil
		},
	)
}
