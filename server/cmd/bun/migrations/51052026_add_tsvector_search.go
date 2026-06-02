package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add instrument tsvector search ")
			_, err := db.ExecContext(ctx, `
				-- 1. Add search_vector column
				ALTER TABLE sigma_finance.instruments
				ADD COLUMN IF NOT EXISTS search_vector tsvector;

				-- 2. Function to recalculate the search vector from symbol + name + aliases
				CREATE OR REPLACE FUNCTION sigma_finance.update_instrument_search_vector()
				RETURNS trigger AS $$
				BEGIN
					NEW.search_vector :=
						setweight(to_tsvector('simple', COALESCE(NEW.normalized_symbol, '')), 'A') ||
						setweight(to_tsvector('simple', COALESCE(NEW.normalized_name, '')), 'B') ||
						setweight(to_tsvector('simple', COALESCE((
							SELECT string_agg(normalized_alias_text, ' ')
							FROM sigma_finance.instrument_aliases
							WHERE instrument_id = NEW.id
						), '')), 'C');
					RETURN NEW;
				END;
				$$ LANGUAGE plpgsql;

				-- 3. Trigger on instruments: fires on insert or when searchable columns change
				CREATE TRIGGER trigger_instrument_search_vector
				BEFORE INSERT OR UPDATE OF normalized_symbol, normalized_name
				ON sigma_finance.instruments
				FOR EACH ROW EXECUTE PROCEDURE sigma_finance.update_instrument_search_vector();

				-- 4. Trigger on aliases: forces parent instrument to recalculate its vector
				CREATE OR REPLACE FUNCTION sigma_finance.update_instrument_from_alias()
				RETURNS trigger AS $$
				BEGIN
					UPDATE sigma_finance.instruments
					SET normalized_name = normalized_name
					WHERE id = COALESCE(NEW.instrument_id, OLD.instrument_id);
					RETURN NULL;
				END;
				$$ LANGUAGE plpgsql;

				CREATE TRIGGER trigger_instrument_alias_vector
				AFTER INSERT OR UPDATE OR DELETE ON sigma_finance.instrument_aliases
				FOR EACH ROW EXECUTE PROCEDURE sigma_finance.update_instrument_from_alias();

				-- 5. Ensure index on instrument_aliases.instrument_id for fast subquery
				--    lookups during backfill and alias-triggered vector recalculation.
				CREATE INDEX IF NOT EXISTS instrument_aliases_instrument_id_idx
				ON sigma_finance.instrument_aliases (instrument_id);

				-- 6. Backfill existing instruments
				UPDATE sigma_finance.instruments SET normalized_name = normalized_name;

				-- 7. GIN index for fast tsvector lookups
				CREATE INDEX IF NOT EXISTS instruments_search_vector_idx
				ON sigma_finance.instruments USING GIN (search_vector);
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Remove instrument tsvector search ")
			_, err := db.ExecContext(ctx, `
				DROP INDEX IF EXISTS sigma_finance.instruments_search_vector_idx;
				DROP TRIGGER IF EXISTS trigger_instrument_alias_vector ON sigma_finance.instrument_aliases;
				DROP FUNCTION IF EXISTS sigma_finance.update_instrument_from_alias;
				DROP TRIGGER IF EXISTS trigger_instrument_search_vector ON sigma_finance.instruments;
				DROP FUNCTION IF EXISTS sigma_finance.update_instrument_search_vector;
				ALTER TABLE sigma_finance.instruments DROP COLUMN IF EXISTS search_vector;
			`)
			return err
		},
	)
}
