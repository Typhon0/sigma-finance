package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
    Migrations.MustRegister(
        func(ctx context.Context, db *bun.DB) error {
            fmt.Print(" [up migration] Add market data credential & candle tables ")
            _, err := db.ExecContext(ctx, `
                CREATE TABLE IF NOT EXISTS sigma_finance.market_data_credential (
                    id SERIAL PRIMARY KEY,
                    user_id INT NOT NULL REFERENCES sigma_finance.user(id) ON DELETE CASCADE,
                    provider TEXT NOT NULL,
                    api_key TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT now(),
                    updated_at TIMESTAMPTZ DEFAULT now(),
                    UNIQUE(user_id, provider)
                );

                CREATE TABLE IF NOT EXISTS sigma_finance.candle (
                    symbol TEXT NOT NULL,
                    asset_type TEXT NOT NULL,
                    interval TEXT NOT NULL,
                    open BIGINT NOT NULL,
                    high BIGINT NOT NULL,
                    low BIGINT NOT NULL,
                    close BIGINT NOT NULL,
                    volume DOUBLE PRECISION,
                    timestamp TIMESTAMPTZ NOT NULL,
                    source TEXT NOT NULL,
                    PRIMARY KEY (symbol, asset_type, interval, timestamp)
                );

                CREATE INDEX IF NOT EXISTS idx_candle_symbol_interval_time ON sigma_finance.candle(symbol, interval, timestamp DESC);
            `)
            return err
        },
        func(ctx context.Context, db *bun.DB) error {
            fmt.Print(" [down migration] Drop market data tables ")
            _, err := db.ExecContext(ctx, `
                DROP TABLE IF EXISTS sigma_finance.candle;
                DROP TABLE IF EXISTS sigma_finance.market_data_credential;
            `)
            return err
        },
    )
}
