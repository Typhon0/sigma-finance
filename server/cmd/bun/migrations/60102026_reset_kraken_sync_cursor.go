package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Reset Kraken sync cursor so the next sync re-imports the full ledger history ")

			// The Kraken adapter used to read a single unpaged /0/private/Ledgers
			// response, so a connection synced before that fix holds only the
			// newest ledger entries: buys older than the newest page were never
			// imported, and every position they cover was left with a
			// placeholder acquisition date at the sync date. FetchTransactions
			// only walks back past the stored cursor on a full pass, so clearing
			// last_sync_at once per Kraken connection lets the next sync backfill
			// the real buy dates through the fixed pagination.
			_, err := db.ExecContext(ctx, `
				UPDATE sigma_finance.sync_connections
				SET last_sync_at = NULL,
					updated_at = current_timestamp
				WHERE UPPER(provider) = 'KRAKEN'
				  AND last_sync_at IS NOT NULL;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Reset Kraken sync cursor (the previous cursor cannot be restored) ")
			_, err := db.ExecContext(ctx, `SELECT 1;`)
			return err
		},
	)
}
