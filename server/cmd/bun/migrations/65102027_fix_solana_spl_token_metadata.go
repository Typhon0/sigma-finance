package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Repair Solana SPL token metadata (USDC, USDT, etc.) ")

			_, err := db.ExecContext(ctx, `
				UPDATE sigma_finance.wallet_balances
				SET symbol = 'USDC',
				    name = 'USD Coin',
				    decimals = 6,
				    is_spam = false,
				    is_hidden = false,
				    cost_basis_currency = 'USD'
				WHERE token_address = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

				UPDATE sigma_finance.wallet_balances
				SET symbol = 'USDT',
				    name = 'Tether USD',
				    decimals = 6,
				    is_spam = false,
				    is_hidden = false,
				    cost_basis_currency = 'USD'
				WHERE token_address = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

				UPDATE sigma_finance.wallet_balances
				SET symbol = 'WSOL',
				    name = 'Wrapped SOL',
				    decimals = 9
				WHERE token_address = 'So11111111111111111111111111111111111111112';

				UPDATE sigma_finance.wallet_balances
				SET symbol = 'JUP',
				    name = 'Jupiter',
				    decimals = 6
				WHERE token_address = 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN';

				UPDATE sigma_finance.wallet_balances
				SET symbol = 'BONK',
				    name = 'Bonk',
				    decimals = 5
				WHERE token_address = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

				UPDATE sigma_finance.wallet_balances
				SET symbol = 'WIF',
				    name = 'dogwifhat',
				    decimals = 6
				WHERE token_address = 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm';
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Rollback Solana SPL token metadata repair ")
			return nil
		},
	)
}
