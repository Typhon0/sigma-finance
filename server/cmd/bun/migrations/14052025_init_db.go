package migrations

import (
	"context"
	"fmt"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [up migration] ")
			_, err := db.ExecContext(ctx, `
CREATE SCHEMA IF NOT EXISTS sigma_finance;
CREATE TABLE IF NOT EXISTS sigma_finance.user (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sigma_finance.asset_type (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS sigma_finance.asset (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    asset_type_id INT REFERENCES sigma_finance.asset_type(id),
    current_value DECIMAL(18, 2),
    purchase_date DATE,
    purchase_price DECIMAL(18, 2)
);
CREATE TABLE IF NOT EXISTS sigma_finance.stock (
    asset_id INT PRIMARY KEY REFERENCES sigma_finance.asset(id),
    ticker VARCHAR(20),
    quantity DECIMAL(18, 8),
    buying_price DECIMAL(18, 2)
);
CREATE TABLE IF NOT EXISTS sigma_finance.crypto (
    asset_id INT PRIMARY KEY REFERENCES sigma_finance.asset(id),
    wallet_address VARCHAR(100),
    blockchain_network VARCHAR(50),
    quantity DECIMAL(18, 8)
);
CREATE TABLE IF NOT EXISTS sigma_finance.portfolio (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES sigma_finance.user(id),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sigma_finance.portfolio_asset (
    portfolio_id INT REFERENCES sigma_finance.portfolio(id),
    asset_id INT REFERENCES sigma_finance.asset(id),
    quantity DECIMAL(18, 8),
    average_purchase_price DECIMAL(18, 2),
    PRIMARY KEY (portfolio_id, asset_id)
);
CREATE TABLE IF NOT EXISTS sigma_finance.transaction (
    id SERIAL PRIMARY KEY,
    portfolio_id INT REFERENCES sigma_finance.portfolio(id),
    asset_id INT REFERENCES sigma_finance.asset(id),
    transaction_type VARCHAR(10) NOT NULL,
    quantity DECIMAL(18, 8),
    price_per_unit DECIMAL(18, 2),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);
CREATE TABLE IF NOT EXISTS sigma_finance.watchlist (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES sigma_finance.user(id),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sigma_finance.watchlist_asset (
    watchlist_id INT REFERENCES sigma_finance.watchlist(id),
    asset_id INT REFERENCES sigma_finance.asset(id),
    PRIMARY KEY (watchlist_id, asset_id)
);
CREATE TABLE IF NOT EXISTS sigma_finance.alert (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES sigma_finance.user(id),
    asset_id INT REFERENCES sigma_finance.asset(id),
    condition TEXT NOT NULL,
    notification_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    triggered_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sigma_finance.report (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES sigma_finance.user(id),
    name VARCHAR(100) NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    report_data TEXT
);
CREATE TABLE IF NOT EXISTS sigma_finance.tag (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS sigma_finance.portfolio_tag (
    portfolio_id INT REFERENCES sigma_finance.portfolio(id),
    tag_id INT REFERENCES sigma_finance.tag(id),
    PRIMARY KEY (portfolio_id, tag_id)
);
CREATE TABLE IF NOT EXISTS sigma_finance.asset_tag (
    asset_id INT REFERENCES sigma_finance.asset(id),
    tag_id INT REFERENCES sigma_finance.tag(id),
    PRIMARY KEY (asset_id, tag_id)
);
CREATE TABLE IF NOT EXISTS sigma_finance.ownership (
    asset_id INT REFERENCES sigma_finance.asset(id),
    user_id INT REFERENCES sigma_finance.user(id),
    ownership_percentage DECIMAL(5, 2) CHECK (ownership_percentage > 0 AND ownership_percentage <= 100),
    PRIMARY KEY (asset_id, user_id)
);
			`)
			return err
		},
		func(ctx context.Context, db *bun.DB) error {
			fmt.Print(" [down migration] ")
			_, err := db.ExecContext(ctx, `
DROP TABLE IF EXISTS sigma_finance.ownership;
DROP TABLE IF EXISTS sigma_finance.asset_tag;
DROP TABLE IF EXISTS sigma_finance.portfolio_tag;
DROP TABLE IF EXISTS sigma_finance.tag;
DROP TABLE IF EXISTS sigma_finance.report;
DROP TABLE IF EXISTS sigma_finance.alert;
DROP TABLE IF EXISTS sigma_finance.watchlist_asset;
DROP TABLE IF EXISTS sigma_finance.watchlist;
DROP TABLE IF EXISTS sigma_finance.transaction;
DROP TABLE IF EXISTS sigma_finance.portfolio_asset;
DROP TABLE IF EXISTS sigma_finance.portfolio;
DROP TABLE IF EXISTS sigma_finance.crypto;
DROP TABLE IF EXISTS sigma_finance.stock;
DROP TABLE IF EXISTS sigma_finance.asset;
DROP TABLE IF EXISTS sigma_finance.asset_type;
DROP TABLE IF EXISTS sigma_finance.user;
			`)
			return err
		},
	)
}
