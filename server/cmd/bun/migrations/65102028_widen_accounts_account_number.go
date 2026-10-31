package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Widen accounts.account_number to VARCHAR(255) and link unassigned wallet accounts ")

			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.accounts 
				ALTER COLUMN account_number TYPE VARCHAR(255);

				DO $$
				DECLARE
					w RECORD;
					target_portfolio_id UUID;
					new_account_id UUID;
					acc_name TEXT;
				BEGIN
					FOR w IN SELECT * FROM sigma_finance.wallet_accounts WHERE account_id IS NULL LOOP
						SELECT id INTO target_portfolio_id FROM sigma_finance.portfolio WHERE user_id = w.user_id ORDER BY created_at ASC LIMIT 1;
						IF target_portfolio_id IS NOT NULL THEN
							acc_name := COALESCE(NULLIF(TRIM(w.label), ''), w.network || ' Wallet');
							INSERT INTO sigma_finance.accounts (
								user_id, portfolio_id, name, type, tax_wrapper, account_number, currency, sync_provider, created_at, updated_at
							) VALUES (
								w.user_id, target_portfolio_id, acc_name, 'CRYPTO_WALLET', 'STANDARD_TAXABLE', w.address_or_xpub, 'USD', 'MEMPOOL', NOW(), NOW()
							) RETURNING id INTO new_account_id;

							UPDATE sigma_finance.wallet_accounts SET account_id = new_account_id WHERE id = w.id;
						END IF;
					END LOOP;
				END $$;
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Revert accounts.account_number to VARCHAR(100) ")
			_, err := db.ExecContext(ctx, `
				ALTER TABLE sigma_finance.accounts 
				ALTER COLUMN account_number TYPE VARCHAR(100);
			`)
			return err
		},
	)
}

