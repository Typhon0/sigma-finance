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
	Position() IPositionRepository
	Transaction() ITransactionRepository
	Watchlist() IWatchlistRepository
	WatchlistAsset() IWatchlistAssetRepository
	Tag() ITagRepository
	PortfolioAsset() IPortfolioAssetRepository
	Stock() IStockRepository
	Crypto() ICryptoRepository
	Fund() IFundRepository
	Instrument() IInstrumentRepository
	InstrumentProviderMapping() IInstrumentProviderMappingRepository
	InstrumentAlias() IInstrumentAliasRepository
	InstrumentSyncState() IInstrumentSyncStateRepository
	DiscoveryLog() IDiscoveryLogRepository
	CatalogSyncRun() ICatalogSyncRunRepository
	FinanceDatabaseSyncSetting() IFinanceDatabaseSyncSettingRepository
	FinanceDatabaseSyncHistory() IFinanceDatabaseSyncHistoryRepository
	AssetType() IAssetTypeRepository
	PortfolioTag() IPortfolioTagRepository
	AssetTag() IAssetTagRepository
	MarketDataCredential() IMarketDataCredentialRepository
	// Authentication repositories
	Session() ISessionRepository
	AuthEvent() AuthEventRepository
	PasswordResetToken() IPasswordResetTokenRepository
	EmailVerificationToken() IEmailVerificationTokenRepository

	// Performance and price repositories
	AssetPrice() IPriceRepository
	Performance() IPerformanceRepository

	// Alert repository
	Alert() IAlertRepository

	// Notification repositories
	NotificationPreferences() INotificationPreferencesRepository
	NotificationLog() INotificationLogRepository
	PushSubscription() IPushSubscriptionRepository

	// Provider routing config repository
	ProviderRoutingConfig() IProviderRoutingConfigRepository

	// FX rate repository
	FXRate() IFXRateRepository
}

// UnitOfWork is the concrete implementation of IUnitOfWork
type UnitOfWork struct {
	db                         *bun.DB
	user                       IUserRepository
	portfolio                  IPortfolioRepository
	asset                      IAssetRepository
	position                   IPositionRepository
	transaction                ITransactionRepository
	watchlist                  IWatchlistRepository
	watchlistAsset             IWatchlistAssetRepository
	tag                        ITagRepository
	portfolioAsset             IPortfolioAssetRepository
	stock                      IStockRepository
	crypto                     ICryptoRepository
	fund                       IFundRepository
	instrument                 IInstrumentRepository
	instrumentProviderMapping  IInstrumentProviderMappingRepository
	instrumentAlias            IInstrumentAliasRepository
	instrumentSyncState        IInstrumentSyncStateRepository
	discoveryLog               IDiscoveryLogRepository
	catalogSyncRun             ICatalogSyncRunRepository
	financeDatabaseSyncSetting IFinanceDatabaseSyncSettingRepository
	financeDatabaseSyncHistory IFinanceDatabaseSyncHistoryRepository
	assetType                  IAssetTypeRepository
	portfolioTag               IPortfolioTagRepository
	assetTag                   IAssetTagRepository
	mdCred                     IMarketDataCredentialRepository
	// Authentication repositories
	session                ISessionRepository
	authEvent              AuthEventRepository
	passwordResetToken     IPasswordResetTokenRepository
	emailVerificationToken IEmailVerificationTokenRepository

	// Performance and price repositories
	assetPrice  IPriceRepository
	performance IPerformanceRepository

	// Alert repository
	alert IAlertRepository

	// Notification repositories
	notificationPrefs INotificationPreferencesRepository
	notificationLog   INotificationLogRepository
	pushSubscription  IPushSubscriptionRepository

	// Provider routing config repository
	providerRoutingConfig IProviderRoutingConfigRepository

	// FX rate repository
	fxRateRepo *FXRateRepository
}

// Expose DB for internal wiring (not part of interface to preserve abstraction)
func (uow *UnitOfWork) GetDB() *bun.DB { return uow.db }

// NewUnitOfWork creates a new UnitOfWork
func NewUnitOfWork(db *bun.DB) IUnitOfWork {
	return &UnitOfWork{
		db:                         db,
		user:                       NewUserRepository(db),
		portfolio:                  NewPortfolioRepository(db),
		asset:                      NewAssetRepository(db),
		position:                   NewPositionRepository(db),
		transaction:                NewTransactionRepository(db),
		watchlist:                  NewWatchlistRepository(NewRepository[model.Watchlist](db), NewRepository[model.WatchlistAsset](db), NewRepository[model.Asset](db)),
		watchlistAsset:             NewWatchlistAssetRepository(db),
		tag:                        NewTagRepository(db),
		portfolioAsset:             NewPortfolioAssetRepository(db),
		stock:                      NewStockRepository(db),
		crypto:                     NewCryptoRepository(db),
		fund:                       NewFundRepository(db),
		instrument:                 NewInstrumentRepository(db),
		instrumentProviderMapping:  NewInstrumentProviderMappingRepository(db),
		instrumentAlias:            NewInstrumentAliasRepository(db),
		instrumentSyncState:        NewInstrumentSyncStateRepository(db),
		discoveryLog:               NewDiscoveryLogRepository(db),
		catalogSyncRun:             NewCatalogSyncRunRepository(db),
		financeDatabaseSyncSetting: NewFinanceDatabaseSyncSettingRepository(db),
		financeDatabaseSyncHistory: NewFinanceDatabaseSyncHistoryRepository(db),
		assetType:                  NewAssetTypeRepository(db),
		portfolioTag:               NewPortfolioTagRepository(db),
		assetTag:                   NewAssetTagRepository(db),
		mdCred:                     NewMarketDataCredentialRepository(db),
		session:                    NewSessionRepository(db),
		authEvent:                  NewAuthEventRepository(db),
		passwordResetToken:         NewPasswordResetTokenRepository(db),
		emailVerificationToken:     NewEmailVerificationTokenRepository(db),
		assetPrice:                 NewPriceRepository(db),
		performance:                NewPerformanceRepository(db),
		alert:                      NewAlertRepository(db),
		notificationPrefs:          NewNotificationPreferencesRepository(db),
		notificationLog:            NewNotificationLogRepository(db),
		pushSubscription:           NewPushSubscriptionRepository(db),
		providerRoutingConfig:      NewProviderRoutingConfigRepository(db),
		fxRateRepo:                 NewFXRateRepository(db),
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
		tx:                         tx,
		user:                       NewUserRepository(&tx),
		portfolio:                  NewPortfolioRepository(&tx),
		asset:                      NewAssetRepository(&tx),
		position:                   NewPositionRepository(&tx),
		transaction:                NewTransactionRepository(&tx),
		watchlist:                  NewWatchlistRepository(NewRepository[model.Watchlist](&tx), NewRepository[model.WatchlistAsset](&tx), NewRepository[model.Asset](&tx)),
		watchlistAsset:             NewWatchlistAssetRepository(&tx),
		tag:                        NewTagRepository(&tx),
		portfolioAsset:             NewPortfolioAssetRepository(&tx),
		stock:                      NewStockRepository(&tx),
		crypto:                     NewCryptoRepository(&tx),
		fund:                       NewFundRepository(&tx),
		instrument:                 NewInstrumentRepository(&tx),
		instrumentProviderMapping:  NewInstrumentProviderMappingRepository(&tx),
		instrumentAlias:            NewInstrumentAliasRepository(&tx),
		instrumentSyncState:        NewInstrumentSyncStateRepository(&tx),
		discoveryLog:               NewDiscoveryLogRepository(&tx),
		catalogSyncRun:             NewCatalogSyncRunRepository(&tx),
		financeDatabaseSyncSetting: NewFinanceDatabaseSyncSettingRepository(&tx),
		financeDatabaseSyncHistory: NewFinanceDatabaseSyncHistoryRepository(&tx),
		assetType:                  NewAssetTypeRepository(&tx),
		portfolioTag:               NewPortfolioTagRepository(&tx),
		assetTag:                   NewAssetTagRepository(&tx),
		// market data credentials not tied to tx; reuse main connection via wrapper if needed (simplified: nil)
		mdCred:                 nil,
		session:                NewSessionRepository(&tx),
		authEvent:              NewAuthEventRepository(&tx),
		passwordResetToken:     NewPasswordResetTokenRepository(&tx),
		emailVerificationToken: NewEmailVerificationTokenRepository(&tx),
		assetPrice:             NewPriceRepository(&tx),
		performance:            NewPerformanceRepository(&tx),
		alert:                  NewAlertRepository(&tx),
		notificationPrefs:      NewNotificationPreferencesRepository(&tx),
		notificationLog:        NewNotificationLogRepository(&tx),
		pushSubscription:       NewPushSubscriptionRepository(&tx),
		providerRoutingConfig:  NewProviderRoutingConfigRepository(&tx),
		fxRateRepo:             NewFXRateRepository(&tx),
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

// Position returns the position repository
func (uow *UnitOfWork) Position() IPositionRepository {
	return uow.position
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

// Fund returns the fund repository
func (uow *UnitOfWork) Fund() IFundRepository {
	return uow.fund
}

// Instrument returns the instrument repository
func (uow *UnitOfWork) Instrument() IInstrumentRepository {
	return uow.instrument
}

func (uow *UnitOfWork) InstrumentProviderMapping() IInstrumentProviderMappingRepository {
	return uow.instrumentProviderMapping
}

// InstrumentAlias returns the instrument alias repository
func (uow *UnitOfWork) InstrumentAlias() IInstrumentAliasRepository {
	return uow.instrumentAlias
}

// InstrumentSyncState returns the instrument sync state repository
func (uow *UnitOfWork) InstrumentSyncState() IInstrumentSyncStateRepository {
	return uow.instrumentSyncState
}

// DiscoveryLog returns the discovery log repository
func (uow *UnitOfWork) DiscoveryLog() IDiscoveryLogRepository {
	return uow.discoveryLog
}

func (uow *UnitOfWork) CatalogSyncRun() ICatalogSyncRunRepository {
	return uow.catalogSyncRun
}

// FinanceDatabaseSyncSetting returns the finance database sync settings repository
func (uow *UnitOfWork) FinanceDatabaseSyncSetting() IFinanceDatabaseSyncSettingRepository {
	return uow.financeDatabaseSyncSetting
}

// FinanceDatabaseSyncHistory returns the finance database sync history repository
func (uow *UnitOfWork) FinanceDatabaseSyncHistory() IFinanceDatabaseSyncHistoryRepository {
	return uow.financeDatabaseSyncHistory
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

// MarketDataCredential returns the market data credential repository
func (uow *UnitOfWork) MarketDataCredential() IMarketDataCredentialRepository {
	return uow.mdCred
}

// txUnitOfWork is the implementation of IUnitOfWork for transactions
type txUnitOfWork struct {
	tx                         bun.Tx
	user                       IUserRepository
	portfolio                  IPortfolioRepository
	asset                      IAssetRepository
	position                   IPositionRepository
	transaction                ITransactionRepository
	watchlist                  IWatchlistRepository
	watchlistAsset             IWatchlistAssetRepository
	tag                        ITagRepository
	portfolioAsset             IPortfolioAssetRepository
	stock                      IStockRepository
	crypto                     ICryptoRepository
	fund                       IFundRepository
	instrument                 IInstrumentRepository
	instrumentProviderMapping  IInstrumentProviderMappingRepository
	instrumentAlias            IInstrumentAliasRepository
	instrumentSyncState        IInstrumentSyncStateRepository
	discoveryLog               IDiscoveryLogRepository
	catalogSyncRun             ICatalogSyncRunRepository
	financeDatabaseSyncSetting IFinanceDatabaseSyncSettingRepository
	financeDatabaseSyncHistory IFinanceDatabaseSyncHistoryRepository
	assetType                  IAssetTypeRepository
	portfolioTag               IPortfolioTagRepository
	assetTag                   IAssetTagRepository
	mdCred                     IMarketDataCredentialRepository
	session                    ISessionRepository
	authEvent                  AuthEventRepository
	passwordResetToken         IPasswordResetTokenRepository
	emailVerificationToken     IEmailVerificationTokenRepository
	assetPrice                 IPriceRepository
	performance                IPerformanceRepository
	alert                      IAlertRepository
	notificationPrefs          INotificationPreferencesRepository
	notificationLog            INotificationLogRepository
	pushSubscription           IPushSubscriptionRepository
	providerRoutingConfig      IProviderRoutingConfigRepository
	fxRateRepo                 *FXRateRepository
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

func (uow *txUnitOfWork) Position() IPositionRepository {
	return uow.position
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

func (uow *txUnitOfWork) Fund() IFundRepository {
	return uow.fund
}

func (uow *txUnitOfWork) Instrument() IInstrumentRepository {
	return uow.instrument
}

func (uow *txUnitOfWork) InstrumentProviderMapping() IInstrumentProviderMappingRepository {
	return uow.instrumentProviderMapping
}

func (uow *txUnitOfWork) InstrumentAlias() IInstrumentAliasRepository {
	return uow.instrumentAlias
}

func (uow *txUnitOfWork) InstrumentSyncState() IInstrumentSyncStateRepository {
	return uow.instrumentSyncState
}

func (uow *txUnitOfWork) DiscoveryLog() IDiscoveryLogRepository {
	return uow.discoveryLog
}

func (uow *txUnitOfWork) CatalogSyncRun() ICatalogSyncRunRepository {
	return uow.catalogSyncRun
}

func (uow *txUnitOfWork) FinanceDatabaseSyncSetting() IFinanceDatabaseSyncSettingRepository {
	return uow.financeDatabaseSyncSetting
}

func (uow *txUnitOfWork) FinanceDatabaseSyncHistory() IFinanceDatabaseSyncHistoryRepository {
	return uow.financeDatabaseSyncHistory
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

func (uow *txUnitOfWork) MarketDataCredential() IMarketDataCredentialRepository {
	return uow.mdCred
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

// AssetPrice returns the asset price repository
func (uow *UnitOfWork) AssetPrice() IPriceRepository {
	return uow.assetPrice
}
func (uow *txUnitOfWork) AssetPrice() IPriceRepository {
	return uow.assetPrice
}

// Performance returns the performance repository
func (uow *UnitOfWork) Performance() IPerformanceRepository {
	return uow.performance
}
func (uow *txUnitOfWork) Performance() IPerformanceRepository {
	return uow.performance
}

// Alert returns the alert repository
func (uow *UnitOfWork) Alert() IAlertRepository {
	return uow.alert
}
func (uow *txUnitOfWork) Alert() IAlertRepository {
	return uow.alert
}

// NotificationPreferences returns the notification preferences repository
func (uow *UnitOfWork) NotificationPreferences() INotificationPreferencesRepository {
	return uow.notificationPrefs
}
func (uow *txUnitOfWork) NotificationPreferences() INotificationPreferencesRepository {
	return uow.notificationPrefs
}

// NotificationLog returns the notification log repository
func (uow *UnitOfWork) NotificationLog() INotificationLogRepository {
	return uow.notificationLog
}
func (uow *txUnitOfWork) NotificationLog() INotificationLogRepository {
	return uow.notificationLog
}

// PushSubscription returns the push subscription repository
func (uow *UnitOfWork) PushSubscription() IPushSubscriptionRepository {
	return uow.pushSubscription
}
func (uow *txUnitOfWork) PushSubscription() IPushSubscriptionRepository {
	return uow.pushSubscription
}

// ProviderRoutingConfig returns the provider routing config repository
func (uow *UnitOfWork) ProviderRoutingConfig() IProviderRoutingConfigRepository {
	return uow.providerRoutingConfig
}
func (uow *txUnitOfWork) ProviderRoutingConfig() IProviderRoutingConfigRepository {
	return uow.providerRoutingConfig
}

// FXRate returns the FX rate repository
func (uow *UnitOfWork) FXRate() IFXRateRepository {
	return uow.fxRateRepo
}
func (uow *txUnitOfWork) FXRate() IFXRateRepository {
	return uow.fxRateRepo
}
