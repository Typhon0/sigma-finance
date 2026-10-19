package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add tax_wrapper to portfolio, tax_jurisdiction to user, is_tax_exempt to tax_lot_dispositions ")

			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.portfolio
					ADD COLUMN IF NOT EXISTS tax_wrapper VARCHAR(30) NOT NULL DEFAULT 'STANDARD_TAXABLE';

				ALTER TABLE sigma_finance."user"
					ADD COLUMN IF NOT EXISTS tax_jurisdiction VARCHAR(10) NOT NULL DEFAULT 'FR';

				ALTER TABLE sigma_finance.tax_lot_dispositions
					ADD COLUMN IF NOT EXISTS is_tax_exempt BOOLEAN NOT NULL DEFAULT FALSE;

				COMMENT ON COLUMN sigma_finance.portfolio.tax_wrapper IS
					'Fiscal account envelope type: STANDARD_TAXABLE, PEA, RETIREMENT_SHELTERED, CRYPTO_VAULT';
				COMMENT ON COLUMN sigma_finance."user".tax_jurisdiction IS
					'User primary tax jurisdiction country code: FR, US, DE, UK, CH, OTHER';
				COMMENT ON COLUMN sigma_finance.tax_lot_dispositions.is_tax_exempt IS
					'Whether this disposition occurred inside a tax-sheltered envelope (e.g. PEA) and is exempt from immediate capital gains tax';
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Revert tax_wrapper, tax_jurisdiction, is_tax_exempt ")

			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.portfolio DROP COLUMN IF EXISTS tax_wrapper;
				ALTER TABLE sigma_finance."user" DROP COLUMN IF EXISTS tax_jurisdiction;
				ALTER TABLE sigma_finance.tax_lot_dispositions DROP COLUMN IF EXISTS is_tax_exempt;
			`)
			return err
		},
	)
}
