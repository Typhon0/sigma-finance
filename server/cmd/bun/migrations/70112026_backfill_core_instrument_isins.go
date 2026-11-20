package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Backfill core instrument ISINs and aliases ")

			_, err := db.ExecContext(ctx, `
				UPDATE sigma_finance.instruments SET isin = 'US02079K3059' WHERE symbol IN ('GOOGL', 'ABEA.DE', 'ABEA.F');
				UPDATE sigma_finance.instruments SET isin = 'US02079K1079' WHERE symbol = 'GOOG';
				UPDATE sigma_finance.instruments SET isin = 'US92826C8394' WHERE symbol = 'V' AND exchange = 'New York Stock Exchange';
				UPDATE sigma_finance.instruments SET isin = 'US09290D1019' WHERE symbol = 'BLK' AND exchange = 'New York Stock Exchange';
				UPDATE sigma_finance.instruments SET isin = 'US55354G1004' WHERE symbol = 'MSCI' AND exchange = 'New York Stock Exchange';
				UPDATE sigma_finance.instruments SET isin = 'US67066G1040' WHERE symbol IN ('NVDA', 'NVD.DE', 'NVD.F');
				UPDATE sigma_finance.instruments SET isin = 'US11135F1012' WHERE symbol = 'AVGO' AND exchange = 'NASDAQ Global Select';
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Revert core instrument ISIN updates ")
			return nil
		},
	)
}
