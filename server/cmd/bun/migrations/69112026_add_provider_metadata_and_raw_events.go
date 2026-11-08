package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add provider_metadata to sync_connections and create sync_raw_events table ")

			_, err := db.ExecContext(ctx, `
				-- 1. Add versioned provider_metadata to sync_connections
				ALTER TABLE sigma_finance.sync_connections
					ADD COLUMN IF NOT EXISTS provider_metadata JSONB;

				-- 2. Create sync_raw_events table for lossless, reviewable unknown/non-financial events
				CREATE TABLE IF NOT EXISTS sigma_finance.sync_raw_events (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					connection_id UUID NOT NULL REFERENCES sigma_finance.sync_connections(id) ON DELETE CASCADE,
					provider VARCHAR(50) NOT NULL,
					source_stream VARCHAR(100) NOT NULL,
					external_event_id VARCHAR(255) NOT NULL,
					event_type VARCHAR(100) NOT NULL,
					status VARCHAR(50),
					raw_payload JSONB NOT NULL,
					occurred_at TIMESTAMP WITH TIME ZONE,
					created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
				);

				CREATE INDEX IF NOT EXISTS idx_sync_raw_events_connection ON sigma_finance.sync_raw_events(connection_id);
				CREATE INDEX IF NOT EXISTS idx_sync_raw_events_provider_event ON sigma_finance.sync_raw_events(provider, event_type);
				CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_raw_events_stream_event ON sigma_finance.sync_raw_events(connection_id, source_stream, external_event_id);
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Revert provider_metadata and drop sync_raw_events table ")

			_, err := db.ExecContext(ctx, `
				DROP TABLE IF EXISTS sigma_finance.sync_raw_events CASCADE;
				ALTER TABLE sigma_finance.sync_connections
					DROP COLUMN IF EXISTS provider_metadata;
			`)
			return err
		},
	)
}

