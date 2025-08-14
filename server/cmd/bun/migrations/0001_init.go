package migrations

import (
	"context"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

func init() {
	Migrations.MustRegister(
		func(ctx context.Context, db *bun.DB) error {
			// User and auth
			if _, err := db.NewCreateTable().Model((*model.User)(nil)).IfNotExists().Exec(ctx); err != nil {
				return err
			}
			// Portfolio
			if _, err := db.NewCreateTable().Model((*model.Portfolio)(nil)).IfNotExists().Exec(ctx); err != nil {
				return err
			}
			// Asset
			if _, err := db.NewCreateTable().Model((*model.Asset)(nil)).IfNotExists().Exec(ctx); err != nil {
				return err
			}
			// AssetType
			if _, err := db.NewCreateTable().Model((*model.AssetType)(nil)).IfNotExists().Exec(ctx); err != nil {
				return err
			}
			// Tag
			if _, err := db.NewCreateTable().Model((*model.Tag)(nil)).IfNotExists().Exec(ctx); err != nil {
				return err
			}
			// PortfolioAsset (link table)
			if _, err := db.NewCreateTable().Model((*model.PortfolioAsset)(nil)).IfNotExists().Exec(ctx); err != nil {
				return err
			}
			// Transaction
			if _, err := db.NewCreateTable().Model((*model.Transaction)(nil)).IfNotExists().Exec(ctx); err != nil {
				return err
			}
			// Watchlist
			if _, err := db.NewCreateTable().Model((*model.Watchlist)(nil)).IfNotExists().Exec(ctx); err != nil {
				return err
			}
			// WatchlistAsset (link table)
			if _, err := db.NewCreateTable().Model((*model.WatchlistAsset)(nil)).IfNotExists().Exec(ctx); err != nil {
				return err
			}
			// Ownership
			if _, err := db.NewCreateTable().Model((*model.Ownership)(nil)).IfNotExists().Exec(ctx); err != nil {
				return err
			}
			// PortfolioTag (link table)
			if _, err := db.NewCreateTable().Model((*model.PortfolioTag)(nil)).IfNotExists().Exec(ctx); err != nil {
				return err
			}
			// AssetTag (link table)
			if _, err := db.NewCreateTable().Model((*model.AssetTag)(nil)).IfNotExists().Exec(ctx); err != nil {
				return err
			}
			// Report
			if _, err := db.NewCreateTable().Model((*model.Report)(nil)).IfNotExists().Exec(ctx); err != nil {
				return err
			}
			// Crypto
			if _, err := db.NewCreateTable().Model((*model.Crypto)(nil)).IfNotExists().Exec(ctx); err != nil {
				return err
			}
			// Stock
			if _, err := db.NewCreateTable().Model((*model.Stock)(nil)).IfNotExists().Exec(ctx); err != nil {
				return err
			}
			// Add more as needed for insurance, real estate, watches, alerts, etc.
			return nil
		},
		func(ctx context.Context, db *bun.DB) error {
			_, err := db.Exec(`
			DROP TABLE IF EXISTS asset;
			DROP TABLE IF EXISTS portfolio;
			DROP TABLE IF EXISTS user;
			`)
			return err
		},
	)
}
