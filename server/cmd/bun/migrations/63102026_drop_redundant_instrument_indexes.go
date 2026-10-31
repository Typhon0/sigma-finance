package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

// The instrument catalog accumulated several overlapping search indexes. The
// combined trigram index (instruments_normalized_symbol_name_trgm_idx) covers
// both normalized_symbol and normalized_name, so the two single-column trigram
// indexes are redundant. instruments_metadata_gin_idx is not referenced by any
// query in the codebase, and instruments_crypto_search_idx duplicates the
// normalized_symbol btrees. Dropping them reclaims ~390 MB on the catalog.
//
// Indexes are recreated with CREATE INDEX CONCURRENTLY if a future query needs
// them; keeping dead indexes costs write throughput on every catalog sync.
func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Drop redundant instrument catalog indexes ")
			_, err := db.ExecContext(ctx, `
				DROP INDEX IF EXISTS sigma_finance.instruments_metadata_gin_idx;
				DROP INDEX IF EXISTS sigma_finance.instruments_normalized_name_trgm_idx;
				DROP INDEX IF EXISTS sigma_finance.instruments_normalized_symbol_trgm_idx;
				DROP INDEX IF EXISTS sigma_finance.instruments_crypto_search_idx;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Recreate redundant instrument catalog indexes ")
			_, err := db.ExecContext(ctx, `
				CREATE INDEX IF NOT EXISTS instruments_metadata_gin_idx
					ON sigma_finance.instruments USING gin (metadata);
				CREATE INDEX IF NOT EXISTS instruments_normalized_name_trgm_idx
					ON sigma_finance.instruments USING gin (normalized_name gin_trgm_ops);
				CREATE INDEX IF NOT EXISTS instruments_normalized_symbol_trgm_idx
					ON sigma_finance.instruments USING gin (normalized_symbol gin_trgm_ops);
				CREATE INDEX IF NOT EXISTS instruments_crypto_search_idx
					ON sigma_finance.instruments USING btree (normalized_symbol, normalized_name, external_id);
			`)
			return err
		},
	)
}
