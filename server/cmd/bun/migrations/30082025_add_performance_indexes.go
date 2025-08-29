package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] Add performance indexes for portfolio operations ")
			_, err := db.ExecContext(ctx, `
				-- Portfolio performance indexes (without CONCURRENTLY for migration compatibility)
				CREATE INDEX IF NOT EXISTS idx_portfolio_user_id 
				ON sigma_finance.portfolio(user_id);
				
				CREATE INDEX IF NOT EXISTS idx_portfolio_user_sort 
				ON sigma_finance.portfolio(user_id, sort_order);
				
				CREATE INDEX IF NOT EXISTS idx_portfolio_name_user 
				ON sigma_finance.portfolio(user_id, name);
				
				CREATE INDEX IF NOT EXISTS idx_portfolio_created_at 
				ON sigma_finance.portfolio(created_at DESC);
				
				CREATE INDEX IF NOT EXISTS idx_portfolio_updated_at 
				ON sigma_finance.portfolio(updated_at DESC);

				-- Portfolio asset performance indexes
				CREATE INDEX IF NOT EXISTS idx_portfolio_asset_portfolio_id 
				ON sigma_finance.portfolio_asset(portfolio_id);
				
				CREATE INDEX IF NOT EXISTS idx_portfolio_asset_asset_id 
				ON sigma_finance.portfolio_asset(asset_id);

				-- Transaction performance indexes
				CREATE INDEX IF NOT EXISTS idx_transaction_portfolio_id 
				ON sigma_finance.transaction(portfolio_id);
				
				CREATE INDEX IF NOT EXISTS idx_transaction_asset_id 
				ON sigma_finance.transaction(asset_id);
				
				CREATE INDEX IF NOT EXISTS idx_transaction_date 
				ON sigma_finance.transaction(transaction_date DESC);
				
				CREATE INDEX IF NOT EXISTS idx_transaction_portfolio_date 
				ON sigma_finance.transaction(portfolio_id, transaction_date DESC);

				-- Asset performance indexes
				CREATE INDEX IF NOT EXISTS idx_asset_type_id 
				ON sigma_finance.asset(asset_type_id);
				
				CREATE INDEX IF NOT EXISTS idx_asset_name 
				ON sigma_finance.asset(name);

				-- Portfolio tag performance indexes
				CREATE INDEX IF NOT EXISTS idx_portfolio_tag_portfolio_id 
				ON sigma_finance.portfolio_tag(portfolio_id);
				
				CREATE INDEX IF NOT EXISTS idx_portfolio_tag_tag_id 
				ON sigma_finance.portfolio_tag(tag_id);

				-- Watchlist performance indexes
				CREATE INDEX IF NOT EXISTS idx_watchlist_user_id 
				ON sigma_finance.watchlist(user_id);
				
				CREATE INDEX IF NOT EXISTS idx_watchlist_asset_watchlist_id 
				ON sigma_finance.watchlist_asset(watchlist_id);

				-- Alert performance indexes
				CREATE INDEX IF NOT EXISTS idx_alert_user_id 
				ON sigma_finance.alert(user_id);
				
				CREATE INDEX IF NOT EXISTS idx_alert_asset_id 
				ON sigma_finance.alert(asset_id);
				
				CREATE INDEX IF NOT EXISTS idx_alert_triggered_at 
				ON sigma_finance.alert(triggered_at) WHERE triggered_at IS NOT NULL;

				-- Composite indexes for common query patterns
				CREATE INDEX IF NOT EXISTS idx_portfolio_user_created 
				ON sigma_finance.portfolio(user_id, created_at DESC);
				
				CREATE INDEX IF NOT EXISTS idx_portfolio_user_updated 
				ON sigma_finance.portfolio(user_id, updated_at DESC);
				
				-- Partial indexes for better performance on filtered queries
				CREATE INDEX IF NOT EXISTS idx_portfolio_has_description 
				ON sigma_finance.portfolio(user_id) WHERE description IS NOT NULL AND description != '';
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] Remove performance indexes ")
			_, err := db.ExecContext(ctx, `
				-- Drop all performance indexes
				DROP INDEX IF EXISTS sigma_finance.idx_portfolio_user_id;
				DROP INDEX IF EXISTS sigma_finance.idx_portfolio_user_sort;
				DROP INDEX IF EXISTS sigma_finance.idx_portfolio_name_user;
				DROP INDEX IF EXISTS sigma_finance.idx_portfolio_created_at;
				DROP INDEX IF EXISTS sigma_finance.idx_portfolio_updated_at;
				DROP INDEX IF EXISTS sigma_finance.idx_portfolio_asset_portfolio_id;
				DROP INDEX IF EXISTS sigma_finance.idx_portfolio_asset_asset_id;
				DROP INDEX IF EXISTS sigma_finance.idx_transaction_portfolio_id;
				DROP INDEX IF EXISTS sigma_finance.idx_transaction_asset_id;
				DROP INDEX IF EXISTS sigma_finance.idx_transaction_date;
				DROP INDEX IF EXISTS sigma_finance.idx_transaction_portfolio_date;
				DROP INDEX IF EXISTS sigma_finance.idx_asset_type_id;
				DROP INDEX IF EXISTS sigma_finance.idx_asset_name;
				DROP INDEX IF EXISTS sigma_finance.idx_portfolio_tag_portfolio_id;
				DROP INDEX IF EXISTS sigma_finance.idx_portfolio_tag_tag_id;
				DROP INDEX IF EXISTS sigma_finance.idx_watchlist_user_id;
				DROP INDEX IF EXISTS sigma_finance.idx_watchlist_asset_watchlist_id;
				DROP INDEX IF EXISTS sigma_finance.idx_alert_user_id;
				DROP INDEX IF EXISTS sigma_finance.idx_alert_asset_id;
				DROP INDEX IF EXISTS sigma_finance.idx_alert_triggered_at;
				DROP INDEX IF EXISTS sigma_finance.idx_portfolio_user_created;
				DROP INDEX IF EXISTS sigma_finance.idx_portfolio_user_updated;
				DROP INDEX IF EXISTS sigma_finance.idx_portfolio_has_description;
			`)
			return err
		},
	)
}
