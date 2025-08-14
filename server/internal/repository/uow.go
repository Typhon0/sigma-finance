// Package repository contains the data access layer for the application.
// This file defines the Unit of Work pattern for managing atomic transactions.
package repository

import (
	"context"
	"database/sql"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// newTxRepository is the private constructor for a transaction-aware repository.
// It is only used internally by the UnitOfWork to ensure all operations within
// the UoW are bound to the same transaction.
func newTxRepository[T any](tx bun.Tx) *Repository[T] {
	return &Repository[T]{db: &tx}
}

// TxRepositories is the container for transaction-bound repositories.
// It's used *only* within a `Do` block.
type TxRepositories struct {
	UserRepo           IUserRepository
	PortfolioRepo      IPortfolioRepository
	AssetRepo          IRepository[model.Asset]
	WatchlistRepo      WatchlistRepository
	WatchlistAssetRepo IRepository[model.WatchlistAsset]
	TransactionRepo    TransactionRepository
	TagRepo            IRepository[model.Tag]
	StockRepo          IRepository[model.Stock]
	ReportRepo         IRepository[model.Report]
	PortfolioTagRepo   IRepository[model.PortfolioTag]
	PortfolioAssetRepo PortfolioAssetRepository
	OwnershipRepo      IRepository[model.Ownership]
	CryptoRepo         IRepository[model.Crypto]
	AssetTypeRepo      IRepository[model.AssetType]
	AssetTagRepo       IRepository[model.AssetTag]
}

// IUnitOfWork defines the interface for our Unit of Work.
// It acts as a factory for standard repositories and exposes the `Do` method
// for executing atomic transactions.
type IUnitOfWork interface {
	User() IUserRepository
	Portfolio() IPortfolioRepository
	Asset() IRepository[model.Asset]
	Watchlist() WatchlistRepository
	WatchlistAsset() IRepository[model.WatchlistAsset]
	Transaction() TransactionRepository
	Tag() IRepository[model.Tag]
	Stock() IRepository[model.Stock]
	Report() IRepository[model.Report]
	PortfolioTag() IRepository[model.PortfolioTag]
	PortfolioAsset() PortfolioAssetRepository
	Ownership() IRepository[model.Ownership]
	Crypto() IRepository[model.Crypto]
	AssetType() IRepository[model.AssetType]
	AssetTag() IRepository[model.AssetTag]
	Do(ctx context.Context, fn func(repos *TxRepositories) error) error
}

// UnitOfWork is the concrete implementation. It holds the DB connection
// and the instances of all standard repositories.
type UnitOfWork struct {
	db *bun.DB

	userRepo           IUserRepository
	portfolioRepo      IPortfolioRepository
	assetRepo          IRepository[model.Asset]
	watchlistRepo      WatchlistRepository
	watchlistAssetRepo IRepository[model.WatchlistAsset]
	transactionRepo    TransactionRepository
	tagRepo            IRepository[model.Tag]
	stockRepo          IRepository[model.Stock]
	reportRepo         IRepository[model.Report]
	portfolioTagRepo   IRepository[model.PortfolioTag]
	portfolioAssetRepo PortfolioAssetRepository
	ownershipRepo      IRepository[model.Ownership]
	cryptoRepo         IRepository[model.Crypto]
	assetTypeRepo      IRepository[model.AssetType]
	assetTagRepo       IRepository[model.AssetTag]
}

// NewUnitOfWork is now the single point of construction for ALL repositories.
func NewUnitOfWork(db *bun.DB) *UnitOfWork {
	// Create base repositories
	userRepo := NewUserRepository(db)
	portfolioRepo := NewPortfolioRepository(db)
	assetRepo := NewRepository[model.Asset](db)
	watchlistBaseRepo := NewRepository[model.Watchlist](db)
	watchlistAssetRepo := NewRepository[model.WatchlistAsset](db)
	transactionBaseRepo := NewRepository[model.Transaction](db)
	tagRepo := NewRepository[model.Tag](db)
	stockRepo := NewRepository[model.Stock](db)
	reportRepo := NewRepository[model.Report](db)
	portfolioTagRepo := NewRepository[model.PortfolioTag](db)
	portfolioAssetBaseRepo := NewRepository[model.PortfolioAsset](db)
	ownershipRepo := NewRepository[model.Ownership](db)
	cryptoRepo := NewRepository[model.Crypto](db)
	assetTypeRepo := NewRepository[model.AssetType](db)
	assetTagRepo := NewRepository[model.AssetTag](db)

	// Create custom repositories
	watchlistRepo := NewWatchlistRepository(watchlistBaseRepo, watchlistAssetRepo, assetRepo)
	transactionRepo := NewTransactionRepository(transactionBaseRepo)
	portfolioAssetRepo := NewPortfolioAssetRepository(portfolioAssetBaseRepo, assetRepo)

	return &UnitOfWork{
		db:                 db,
		userRepo:           userRepo,
		portfolioRepo:      portfolioRepo,
		assetRepo:          assetRepo,
		watchlistRepo:      watchlistRepo,
		watchlistAssetRepo: watchlistAssetRepo,
		transactionRepo:    transactionRepo,
		tagRepo:            tagRepo,
		stockRepo:          stockRepo,
		reportRepo:         reportRepo,
		portfolioTagRepo:   portfolioTagRepo,
		portfolioAssetRepo: portfolioAssetRepo,
		ownershipRepo:      ownershipRepo,
		cryptoRepo:         cryptoRepo,
		assetTypeRepo:      assetTypeRepo,
		assetTagRepo:       assetTagRepo,
	}
}

// Accessor methods to get the standard repositories.
func (uow *UnitOfWork) User() IUserRepository           { return uow.userRepo }
func (uow *UnitOfWork) Portfolio() IPortfolioRepository { return uow.portfolioRepo }
func (uow *UnitOfWork) Asset() IRepository[model.Asset] { return uow.assetRepo }
func (uow *UnitOfWork) Watchlist() WatchlistRepository  { return uow.watchlistRepo }
func (uow *UnitOfWork) WatchlistAsset() IRepository[model.WatchlistAsset] {
	return uow.watchlistAssetRepo
}
func (uow *UnitOfWork) Transaction() TransactionRepository            { return uow.transactionRepo }
func (uow *UnitOfWork) Tag() IRepository[model.Tag]                   { return uow.tagRepo }
func (uow *UnitOfWork) Stock() IRepository[model.Stock]               { return uow.stockRepo }
func (uow *UnitOfWork) Report() IRepository[model.Report]             { return uow.reportRepo }
func (uow *UnitOfWork) PortfolioTag() IRepository[model.PortfolioTag] { return uow.portfolioTagRepo }
func (uow *UnitOfWork) PortfolioAsset() PortfolioAssetRepository {
	return uow.portfolioAssetRepo
}
func (uow *UnitOfWork) Ownership() IRepository[model.Ownership] { return uow.ownershipRepo }
func (uow *UnitOfWork) Crypto() IRepository[model.Crypto]       { return uow.cryptoRepo }
func (uow *UnitOfWork) AssetType() IRepository[model.AssetType] { return uow.assetTypeRepo }
func (uow *UnitOfWork) AssetTag() IRepository[model.AssetTag]   { return uow.assetTagRepo }

// Do executes a given function within the context of a single database transaction.
func (uow *UnitOfWork) Do(ctx context.Context, fn func(repos *TxRepositories) error) error {
	return uow.db.RunInTx(ctx, &sql.TxOptions{}, func(ctx context.Context, tx bun.Tx) error {
		// Create transaction-bound base repositories
		userTxRepo := newTxRepository[model.User](tx)
		portfolioTxRepo := newTxRepository[model.Portfolio](tx)
		assetTxRepo := newTxRepository[model.Asset](tx)
		watchlistBaseTxRepo := newTxRepository[model.Watchlist](tx)
		watchlistAssetTxRepo := newTxRepository[model.WatchlistAsset](tx)
		transactionBaseTxRepo := newTxRepository[model.Transaction](tx)
		tagTxRepo := newTxRepository[model.Tag](tx)
		stockTxRepo := newTxRepository[model.Stock](tx)
		reportTxRepo := newTxRepository[model.Report](tx)
		portfolioTagTxRepo := newTxRepository[model.PortfolioTag](tx)
		portfolioAssetBaseTxRepo := newTxRepository[model.PortfolioAsset](tx)
		ownershipTxRepo := newTxRepository[model.Ownership](tx)
		cryptoTxRepo := newTxRepository[model.Crypto](tx)
		assetTypeTxRepo := newTxRepository[model.AssetType](tx)
		assetTagTxRepo := newTxRepository[model.AssetTag](tx)

		// Create transaction-bound custom repositories
		watchlistTxRepo := NewWatchlistRepository(watchlistBaseTxRepo, watchlistAssetTxRepo, assetTxRepo)
		transactionTxRepo := NewTransactionRepository(transactionBaseTxRepo)
		portfolioAssetTxRepo := NewPortfolioAssetRepository(portfolioAssetBaseTxRepo, assetTxRepo)

		txRepos := &TxRepositories{
			UserRepo:           userTxRepo,
			PortfolioRepo:      portfolioTxRepo,
			AssetRepo:          assetTxRepo,
			WatchlistRepo:      watchlistTxRepo,
			WatchlistAssetRepo: watchlistAssetTxRepo,
			TransactionRepo:    transactionTxRepo,
			TagRepo:            tagTxRepo,
			StockRepo:          stockTxRepo,
			ReportRepo:         reportTxRepo,
			PortfolioTagRepo:   portfolioTagTxRepo,
			PortfolioAssetRepo: portfolioAssetTxRepo,
			OwnershipRepo:      ownershipTxRepo,
			CryptoRepo:         cryptoTxRepo,
			AssetTypeRepo:      assetTypeTxRepo,
			AssetTagRepo:       assetTagTxRepo,
		}
		return fn(txRepos)
	})
}
