package service

import (
	"context"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"

	"github.com/stretchr/testify/mock"
	"github.com/uptrace/bun"
)

// MockUnitOfWork is a mock implementation of IUnitOfWork for testing
type MockUnitOfWork struct {
	mock.Mock
}

func (m *MockUnitOfWork) User() repository.IUserRepository {
	args := m.Called()
	return args.Get(0).(repository.IUserRepository)
}

func (m *MockUnitOfWork) Portfolio() repository.IPortfolioRepository {
	args := m.Called()
	return args.Get(0).(repository.IPortfolioRepository)
}

func (m *MockUnitOfWork) Asset() repository.IRepository[model.Asset] {
	args := m.Called()
	return args.Get(0).(repository.IRepository[model.Asset])
}

func (m *MockUnitOfWork) Watchlist() repository.WatchlistRepository {
	args := m.Called()
	return args.Get(0).(repository.WatchlistRepository)
}

func (m *MockUnitOfWork) WatchlistAsset() repository.IRepository[model.WatchlistAsset] {
	args := m.Called()
	return args.Get(0).(repository.IRepository[model.WatchlistAsset])
}

func (m *MockUnitOfWork) Transaction() repository.TransactionRepository {
	args := m.Called()
	return args.Get(0).(repository.TransactionRepository)
}

func (m *MockUnitOfWork) Tag() repository.IRepository[model.Tag] {
	args := m.Called()
	return args.Get(0).(repository.IRepository[model.Tag])
}

func (m *MockUnitOfWork) Stock() repository.IRepository[model.Stock] {
	args := m.Called()
	return args.Get(0).(repository.IRepository[model.Stock])
}

func (m *MockUnitOfWork) Report() repository.IRepository[model.Report] {
	args := m.Called()
	return args.Get(0).(repository.IRepository[model.Report])
}

func (m *MockUnitOfWork) PortfolioTag() repository.IRepository[model.PortfolioTag] {
	args := m.Called()
	return args.Get(0).(repository.IRepository[model.PortfolioTag])
}

func (m *MockUnitOfWork) PortfolioAsset() repository.PortfolioAssetRepository {
	args := m.Called()
	return args.Get(0).(repository.PortfolioAssetRepository)
}

func (m *MockUnitOfWork) Ownership() repository.IRepository[model.Ownership] {
	args := m.Called()
	return args.Get(0).(repository.IRepository[model.Ownership])
}

func (m *MockUnitOfWork) Crypto() repository.IRepository[model.Crypto] {
	args := m.Called()
	return args.Get(0).(repository.IRepository[model.Crypto])
}

func (m *MockUnitOfWork) AssetType() repository.IRepository[model.AssetType] {
	args := m.Called()
	return args.Get(0).(repository.IRepository[model.AssetType])
}

func (m *MockUnitOfWork) AssetTag() repository.IRepository[model.AssetTag] {
	args := m.Called()
	return args.Get(0).(repository.IRepository[model.AssetTag])
}

func (m *MockUnitOfWork) Do(ctx context.Context, fn func(repos *repository.TxRepositories) error) error {
	args := m.Called(ctx, fn)
	return args.Error(0)
}

// MockAssetRepository is a mock implementation of IRepository[model.Asset] for testing
type MockAssetRepository struct {
	mock.Mock
}

func (m *MockAssetRepository) GetDB() bun.IDB {
	args := m.Called()
	return args.Get(0).(bun.IDB)
}

func (m *MockAssetRepository) Create(ctx context.Context, entity *model.Asset) (*model.Asset, error) {
	args := m.Called(ctx, entity)
	return args.Get(0).(*model.Asset), args.Error(1)
}

func (m *MockAssetRepository) Update(ctx context.Context, entity *model.Asset) error {
	args := m.Called(ctx, entity)
	return args.Error(0)
}

func (m *MockAssetRepository) Delete(ctx context.Context, id uint) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockAssetRepository) GetByID(ctx context.Context, id uint) (model.Asset, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(model.Asset), args.Error(1)
}

func (m *MockAssetRepository) FindOneBy(ctx context.Context, options ...repository.QueryOption) (model.Asset, error) {
	args := m.Called(ctx, options)
	return args.Get(0).(model.Asset), args.Error(1)
}

func (m *MockAssetRepository) FindAllBy(ctx context.Context, options ...repository.QueryOption) ([]model.Asset, error) {
	args := m.Called(ctx, options)
	return args.Get(0).([]model.Asset), args.Error(1)
}

func (m *MockAssetRepository) Count(ctx context.Context, options ...repository.QueryOption) (int, error) {
	args := m.Called(ctx, options)
	return args.Int(0), args.Error(1)
}
