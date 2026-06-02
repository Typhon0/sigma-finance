package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add historical partitions for asset_prices (2010-2030) ")
			_, err := db.ExecContext(ctx, `
				DO $$
				DECLARE
					y INT;
					m INT;
					start_date DATE;
					end_date DATE;
					part_name TEXT;
				BEGIN
					FOR y IN 2010..2030 LOOP
						FOR m IN 1..12 LOOP
							start_date := make_date(y, m, 1);
							end_date := (start_date + INTERVAL '1 month')::DATE;
							part_name := format('asset_prices_%s_%s', y, lpad(m::TEXT, 2, '0'));

							EXECUTE format(
								'CREATE TABLE IF NOT EXISTS sigma_finance.%I PARTITION OF sigma_finance.asset_prices FOR VALUES FROM (%L) TO (%L)',
								part_name,
								start_date::TEXT,
								end_date::TEXT
							);
						END LOOP;
					END LOOP;
				END$$;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Add historical partitions for asset_prices (2010-2030) ")
			_, err := db.ExecContext(ctx, `SELECT 1;`)
			return err
		},
	)
}
