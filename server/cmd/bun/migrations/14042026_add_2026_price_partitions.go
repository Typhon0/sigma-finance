package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add 2026 partitions for asset_prices ")
			_, err := db.ExecContext(ctx, `
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2026_01 PARTITION OF sigma_finance.asset_prices
				FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2026_02 PARTITION OF sigma_finance.asset_prices
				FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2026_03 PARTITION OF sigma_finance.asset_prices
				FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2026_04 PARTITION OF sigma_finance.asset_prices
				FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2026_05 PARTITION OF sigma_finance.asset_prices
				FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2026_06 PARTITION OF sigma_finance.asset_prices
				FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2026_07 PARTITION OF sigma_finance.asset_prices
				FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2026_08 PARTITION OF sigma_finance.asset_prices
				FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2026_09 PARTITION OF sigma_finance.asset_prices
				FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2026_10 PARTITION OF sigma_finance.asset_prices
				FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2026_11 PARTITION OF sigma_finance.asset_prices
				FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
				CREATE TABLE IF NOT EXISTS sigma_finance.asset_prices_2026_12 PARTITION OF sigma_finance.asset_prices
				FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Drop 2026 partitions for asset_prices ")
			_, err := db.ExecContext(ctx, `
				DROP TABLE IF EXISTS sigma_finance.asset_prices_2026_12;
				DROP TABLE IF EXISTS sigma_finance.asset_prices_2026_11;
				DROP TABLE IF EXISTS sigma_finance.asset_prices_2026_10;
				DROP TABLE IF EXISTS sigma_finance.asset_prices_2026_09;
				DROP TABLE IF EXISTS sigma_finance.asset_prices_2026_08;
				DROP TABLE IF EXISTS sigma_finance.asset_prices_2026_07;
				DROP TABLE IF EXISTS sigma_finance.asset_prices_2026_06;
				DROP TABLE IF EXISTS sigma_finance.asset_prices_2026_05;
				DROP TABLE IF EXISTS sigma_finance.asset_prices_2026_04;
				DROP TABLE IF EXISTS sigma_finance.asset_prices_2026_03;
				DROP TABLE IF EXISTS sigma_finance.asset_prices_2026_02;
				DROP TABLE IF EXISTS sigma_finance.asset_prices_2026_01;
			`)
			return err
		},
	)
}
