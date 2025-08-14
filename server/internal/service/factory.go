package service

import "sigma_finance/internal/repository"

// ServiceContainer holds all service instances
type ServiceContainer struct {
	User        IUserService
	Portfolio   IPortfolioService
	Asset       IAssetService
	Transaction ITransactionService
	Watchlist   IWatchlistService
	Tag         ITagService
}

// NewServiceContainer creates a new service container with all services initialized
func NewServiceContainer(uow repository.IUnitOfWork) *ServiceContainer {
	return &ServiceContainer{
		User:        NewUserService(uow),
		Portfolio:   NewPortfolioService(uow),
		Asset:       NewAssetService(uow),
		Transaction: NewTransactionService(uow),
		Watchlist:   NewWatchlistService(uow),
		Tag:         NewTagService(uow),
	}
}
