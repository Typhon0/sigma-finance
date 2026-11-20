// Package graphql contains the GraphQL API layer.
// This file defines the main Resolver struct which holds the dependencies
// needed by all resolver implementations.

package graphql

import (
	"context"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/handler/middleware"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"
	marketdatapacks "sigma_finance/internal/service/marketdata/packs"
	realestate "sigma_finance/internal/service/realestate"
	syncservice "sigma_finance/internal/service/sync"
)

// Resolver serves as the root for dependency injection into your resolvers.
// It holds all the services required to fulfill API requests. This struct is
// embedded in the resolver implementations in other files.
type Resolver struct {
	PortfolioService      service.IPortfolioService
	AccountService        service.IAccountService
	UserService           service.IUserService
	AssetService          service.IAssetService
	TagService            service.ITagService
	TransactionService    service.ITransactionService
	WatchlistService      service.IWatchlistService
	AuthenticationService service.AuthenticationService
	SecurityService       service.SecurityService
	MarketDataService     service.MarketDataService
	MarketDataPackService marketdatapacks.Service
	PerformanceService    service.IPerformanceService
	AlertService          service.IAlertService
	InstrumentService     service.InstrumentService
	RealEstateService     realestate.IRealEstateValuationService
	SyncService           syncservice.ISyncService
	UOW                   repository.IUnitOfWork
}

func (r *Resolver) getDisplayCurrencyFromContext(ctx context.Context) (model.Currency, error) {
	user, err := middleware.RequireAuth(ctx)
	if err != nil {
		return model.CurrencyUSD, err
	}

	// Fetch full user from db to get display currency
	fullUser, err := r.UserService.GetByID(ctx, user.ID)
	if err != nil {
		return model.CurrencyUSD, err
	}
	return fullUser.DisplayCurrency, nil
}
