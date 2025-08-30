// Package graphql contains the GraphQL API layer.
// This file defines the main Resolver struct which holds the dependencies
// needed by all resolver implementations.

package graphql

import (
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"
	"sync"
)

// Resolver serves as the root for dependency injection into your resolvers.
// It holds all the services required to fulfill API requests. This struct is
// embedded in the resolver implementations in other files.
type Resolver struct {
	PortfolioService      service.IPortfolioService
	UserService           service.IUserService
	AssetService          service.IAssetService
	TagService            service.ITagService
	TransactionService    service.ITransactionService
	WatchlistService      service.IWatchlistService
	AuthenticationService service.AuthenticationService
	SecurityService       service.SecurityService
	MarketDataService     service.MarketDataService
	PerformanceService    service.IPerformanceService
	AlertService          service.IAlertService
	UOW                   repository.IUnitOfWork

	// Subscription broadcaster state
	PortfolioSubscribers   map[string][]chan *gqlModel.PortfolioUpdatePayload
	TransactionSubscribers map[string][]chan *gqlModel.TransactionUpdatePayload
	BroadcasterMu          *sync.Mutex
}
