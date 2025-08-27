// Package repository contains the data access layer for the application.
// This file defines the Unit of Work pattern for managing atomic transactions.
package repository

import (
	"context"
	"fmt"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// IUnitOfWork defines the interface for the Unit of Work pattern.
// It provides access to all repositories and manages transactions.
type IUnitOfWork interface {
	Do(ctx context.Context, fn func(uow IUnitOfWork) error) error
	User() IUserRepository
	Portfolio() IPortfolioRepository
	Asset() IAssetRepository
	Transaction() ITransactionRepository
	Watchlist() IWatchlistRepository
	WatchlistAsset() IWatchlistAssetRepository
	Tag() ITagRepository
	PortfolioAsset() IPortfolioAssetRepository
	Stock() IStockRepository
	Crypto() ICryptoRepository
	AssetType() IAssetTypeRepository
	PortfolioTag() IPortfolioTagRepository
	AssetTag() IAssetTagRepository
	// Authentication repositories
	Session() ISessionRepository
	AuthEvent() AuthEventRepository
	PasswordResetToken() IPasswordResetTokenRepository
	EmailVerificationToken() IEmailVerificationTokenRepository
}

// UnitOfWork is the concrete implementation of IUnitOfWork
type UnitOfWork struct {
	db             *bun.DB
	user           IUserRepository
	portfolio      IPortfolioRepository
	asset          IAssetRepository
	transaction    ITransactionRepository
	watchlist      IWatchlistRepository
	watchlistAsset IWatchlistAssetRepository
	tag            ITagRepository
	portfolioAsset IPortfolioAssetRepository
	stock          IStockRepository
	crypto         ICryptoRepository
	assetType      IAssetTypeRepository
	portfolioTag   IPortfolioTagRepository
	assetTag       IAssetTagRepository
	// Authentication repositories
	session                ISessionRepository
	authEvent              AuthEventRepository
	passwordResetToken     IPasswordResetTokenRepository
	emailVerificationToken IEmailVerificationTokenRepository
}

// NewUnitOfWork creates a new UnitOfWork
func NewUnitOfWork(db *bun.DB) IUnitOfWork {
	return &UnitOfWork{
		db:                     db,
		user:                   NewUserRepository(db),
		portfolio:              NewPortfolioRepository(db),
		asset:                  NewAssetRepository(db),
		transaction:            NewTransactionRepository(NewRepository[model.Transaction](db)),
		watchlist:              NewWatchlistRepository(NewRepository[model.Watchlist](db), NewRepository[model.WatchlistAsset](db), NewRepository[model.Asset](db)),
		watchlistAsset:         NewWatchlistAssetRepository(db),
		tag:                    NewTagRepository(db),
		portfolioAsset:         NewPortfolioAssetRepository(db),
		stock:                  NewStockRepository(db),
		crypto:                 NewCryptoRepository(db),
		assetType:              NewAssetTypeRepository(db),
		portfolioTag:           NewPortfolioTagRepository(db),
		assetTag:               NewAssetTagRepository(db),
		session:                NewSessionRepository(db),
		authEvent:              NewAuthEventRepository(db),
		passwordResetToken:     NewPasswordResetTokenRepository(db),
		emailVerificationToken: NewEmailVerificationTokenRepository(db),
	}
}

// Do executes a function within a transaction
func (uow *UnitOfWork) Do(ctx context.Context, fn func(uow IUnitOfWork) error) error {
	tx, err := uow.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	// Create a new UoW with the transaction
	txUow := &txUnitOfWork{
		tx:                     tx,
		user:                   NewUserRepository(&tx),
		portfolio:              NewPortfolioRepository(&tx),
		asset:                  NewAssetRepository(&tx),
		transaction:            NewTransactionRepository(NewRepository[model.Transaction](&tx)),
		watchlist:              NewWatchlistRepository(NewRepository[model.Watchlist](&tx), NewRepository[model.WatchlistAsset](&tx), NewRepository[model.Asset](&tx)),
		watchlistAsset:         NewWatchlistAssetRepository(&tx),
		tag:                    NewTagRepository(&tx),
		portfolioAsset:         NewPortfolioAssetRepository(&tx),
		stock:                  NewStockRepository(&tx),
		crypto:                 NewCryptoRepository(&tx),
		assetType:              NewAssetTypeRepository(&tx),
		portfolioTag:           NewPortfolioTagRepository(&tx),
		assetTag:               NewAssetTagRepository(&tx),
		session:                NewSessionRepository(&tx),
		authEvent:              NewAuthEventRepository(&tx),
		passwordResetToken:     NewPasswordResetTokenRepository(&tx),
		emailVerificationToken: NewEmailVerificationTokenRepository(&tx),
	}

	if err := fn(txUow); err != nil {
		if rbErr := tx.Rollback(); rbErr != nil {
			return fmt.Errorf("tx err: %v, rb err: %v", err, rbErr)
		}
		return err
	}

	return tx.Commit()
}

// User returns the user repository
func (uow *UnitOfWork) User() IUserRepository {
	return uow.user
}

// Portfolio returns the portfolio repository
func (uow *UnitOfWork) Portfolio() IPortfolioRepository {
	return uow.portfolio
}

// Asset returns the asset repository
func (uow *UnitOfWork) Asset() IAssetRepository {
	return uow.asset
}

// Transaction returns the transaction repository
func (uow *UnitOfWork) Transaction() ITransactionRepository {
	return uow.transaction
}

// Watchlist returns the watchlist repository
func (uow *UnitOfWork) Watchlist() IWatchlistRepository {
	return uow.watchlist
}

// WatchlistAsset returns the watchlist asset repository
func (uow *UnitOfWork) WatchlistAsset() IWatchlistAssetRepository {
	return uow.watchlistAsset
}

// Tag returns the tag repository
func (uow *UnitOfWork) Tag() ITagRepository {
	return uow.tag
}

// PortfolioAsset returns the portfolio asset repository
func (uow *UnitOfWork) PortfolioAsset() IPortfolioAssetRepository {
	return uow.portfolioAsset
}

// Stock returns the stock repository
func (uow *UnitOfWork) Stock() IStockRepository {
	return uow.stock
}

// Crypto returns the crypto repository
func (uow *UnitOfWork) Crypto() ICryptoRepository {
	return uow.crypto
}

// AssetType returns the asset type repository
func (uow *UnitOfWork) AssetType() IAssetTypeRepository {
	return uow.assetType
}

// PortfolioTag returns the portfolio tag repository
func (uow *UnitOfWork) PortfolioTag() IPortfolioTagRepository {
	return uow.portfolioTag
}

// AssetTag returns the asset tag repository
func (uow *UnitOfWork) AssetTag() IAssetTagRepository {
	return uow.assetTag
}

// Session returns the session repository
func (uow *UnitOfWork) Session() ISessionRepository {
	return uow.session
}

// AuthEvent returns the auth event repository
func (uow *UnitOfWork) AuthEvent() AuthEventRepository {
	return uow.authEvent
}

// PasswordResetToken returns the password reset token repository
func (uow *UnitOfWork) PasswordResetToken() IPasswordResetTokenRepository {
	return uow.passwordResetToken
}

// EmailVerificationToken returns the email verification token repository
func (uow *UnitOfWork) EmailVerificationToken() IEmailVerificationTokenRepository {
	return uow.emailVerificationToken
}

// txUnitOfWork is the implementation of IUnitOfWork for transactions
type txUnitOfWork struct {
	tx                     bun.Tx
	user                   IUserRepository
	portfolio              IPortfolioRepository
	asset                  IAssetRepository
	transaction            ITransactionRepository
	watchlist              IWatchlistRepository
	watchlistAsset         IWatchlistAssetRepository
	tag                    ITagRepository
	portfolioAsset         IPortfolioAssetRepository
	stock                  IStockRepository
	crypto                 ICryptoRepository
	assetType              IAssetTypeRepository
	portfolioTag           IPortfolioTagRepository
	assetTag               IAssetTagRepository
	session                ISessionRepository
	authEvent              AuthEventRepository
	passwordResetToken     IPasswordResetTokenRepository
	emailVerificationToken IEmailVerificationTokenRepository
}

func (uow *txUnitOfWork) Do(ctx context.Context, fn func(uow IUnitOfWork) error) error {
	// Nested transactions are not supported
	return fn(uow)
}

func (uow *txUnitOfWork) User() IUserRepository {
	return uow.user
}

func (uow *txUnitOfWork) Portfolio() IPortfolioRepository {
	return uow.portfolio
}

func (uow *txUnitOfWork) Asset() IAssetRepository {
	return uow.asset
}

func (uow *txUnitOfWork) Transaction() ITransactionRepository {
	return uow.transaction
}

func (uow *txUnitOfWork) Watchlist() IWatchlistRepository {
	return uow.watchlist
}

func (uow *txUnitOfWork) WatchlistAsset() IWatchlistAssetRepository {
	return uow.watchlistAsset
}

func (uow *txUnitOfWork) Tag() ITagRepository {
	return uow.tag
}

func (uow *txUnitOfWork) PortfolioAsset() IPortfolioAssetRepository {
	return uow.portfolioAsset
}

func (uow *txUnitOfWork) Stock() IStockRepository {
	return uow.stock
}

func (uow *txUnitOfWork) Crypto() ICryptoRepository {
	return uow.crypto
}

func (uow *txUnitOfWork) AssetType() IAssetTypeRepository {
	return uow.assetType
}

func (uow *txUnitOfWork) PortfolioTag() IPortfolioTagRepository {
	return uow.portfolioTag
}

func (uow *txUnitOfWork) AssetTag() IAssetTagRepository {
	return uow.assetTag
}

func (uow *txUnitOfWork) Session() ISessionRepository {
	return uow.session
}

func (uow *txUnitOfWork) AuthEvent() AuthEventRepository {
	return uow.authEvent
}

func (uow *txUnitOfWork) PasswordResetToken() IPasswordResetTokenRepository {
	return uow.passwordResetToken
}

func (uow *txUnitOfWork) EmailVerificationToken() IEmailVerificationTokenRepository {
	return uow.emailVerificationToken
}
