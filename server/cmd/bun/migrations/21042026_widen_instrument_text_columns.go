package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Widen instrument text columns ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.instruments
					ALTER COLUMN summary TYPE TEXT,
					ALTER COLUMN sector TYPE TEXT,
					ALTER COLUMN industry_group TYPE TEXT,
					ALTER COLUMN industry TYPE TEXT,
					ALTER COLUMN category_group TYPE TEXT,
					ALTER COLUMN category TYPE TEXT,
					ALTER COLUMN family TYPE TEXT,
					ALTER COLUMN website TYPE TEXT,
					ALTER COLUMN market_cap TYPE TEXT,
					ALTER COLUMN state TYPE TEXT,
					ALTER COLUMN city TYPE TEXT,
					ALTER COLUMN zipcode TYPE TEXT,
					ALTER COLUMN base_currency TYPE TEXT,
					ALTER COLUMN quote_currency TYPE TEXT,
					ALTER COLUMN underlying_symbol TYPE TEXT;
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
				ALTER TABLE sigma_finance.instruments
					ALTER COLUMN summary TYPE VARCHAR(255),
					ALTER COLUMN sector TYPE VARCHAR(255),
					ALTER COLUMN industry_group TYPE VARCHAR(255),
					ALTER COLUMN industry TYPE VARCHAR(255),
					ALTER COLUMN category_group TYPE VARCHAR(255),
					ALTER COLUMN category TYPE VARCHAR(255),
					ALTER COLUMN family TYPE VARCHAR(255),
					ALTER COLUMN website TYPE VARCHAR(255),
					ALTER COLUMN market_cap TYPE VARCHAR(50),
					ALTER COLUMN state TYPE VARCHAR(100),
					ALTER COLUMN city TYPE VARCHAR(100),
					ALTER COLUMN zipcode TYPE VARCHAR(50),
					ALTER COLUMN base_currency TYPE VARCHAR(20),
					ALTER COLUMN quote_currency TYPE VARCHAR(20),
					ALTER COLUMN underlying_symbol TYPE VARCHAR(50);
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
