package service

import (
	"context"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"testing"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/uptrace/bun"
)

// Mock repositories for testing
type MockAssetRepository struct {
	mock.Mock
}

func (m *MockAssetRepository) Create(ctx context.Context, entity *model.Asset) (*model.Asset, error) {
	args := m.Called(ctx, entity)
	return args.Get(0).(*model.Asset), args.Error(1)
}

func (m *MockAssetRepository) GetByID(ctx context.Context, id uint) (model.Asset, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(model.Asset), args.Error(1)
}

func (m *MockAssetRepository) Update(ctx context.Context, entity *model.Asset) error {
	args := m.Called(ctx, entity)
	return args.Error(0)
}

func (m *MockAssetRepository) Delete(ctx context.Context, id uint) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockAssetRepository) FindAllBy(ctx context.Context, options ...repository.QueryOption) ([]model.Asset, error) {
	args := m.Called(ctx, options)
	return args.Get(0).([]model.Asset), args.Error(1)
}

func (m *MockAssetRepository) GetByUUID(ctx context.Context, id uuid.UUID) (*model.Asset, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Asset), args.Error(1)
}

func (m *MockAssetRepository) GetBySymbol(ctx context.Context, symbol string) (*model.Asset, error) {
	args := m.Called(ctx, symbol)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Asset), args.Error(1)
}

func (m *MockAssetRepository) FindWithFilters(ctx context.Context, filter repository.AssetFilter) ([]model.Asset, error) {
	args := m.Called(ctx, filter)
	return args.Get(0).([]model.Asset), args.Error(1)
}

func (m *MockAssetRepository) CountWithFilters(ctx context.Context, filter repository.AssetFilter) (int, error) {
	args := m.Called(ctx, filter)
	return args.Int(0), args.Error(1)
}

func (m *MockAssetRepository) GetAssetsByType(ctx context.Context, assetType model.AssetType) ([]model.Asset, error) {
	args := m.Called(ctx, assetType)
	return args.Get(0).([]model.Asset), args.Error(1)
}

func (m *MockAssetRepository) GetTradeableAssets(ctx context.Context) ([]model.Asset, error) {
	args := m.Called(ctx)
	return args.Get(0).([]model.Asset), args.Error(1)
}

func (m *MockAssetRepository) SearchAssetsByName(ctx context.Context, searchTerm string, limit int) ([]model.Asset, error) {
	args := m.Called(ctx, searchTerm, limit)
	return args.Get(0).([]model.Asset), args.Error(1)
}

func (m *MockAssetRepository) GetAssetsByMetadataField(ctx context.Context, field string, value interface{}) ([]model.Asset, error) {
	args := m.Called(ctx, field, value)
	return args.Get(0).([]model.Asset), args.Error(1)
}

func (m *MockAssetRepository) CreateBatch(ctx context.Context, assets []model.Asset) error {
	args := m.Called(ctx, assets)
	return args.Error(0)
}

func (m *MockAssetRepository) UpdateBatch(ctx context.Context, assets []model.Asset) error {
	args := m.Called(ctx, assets)
	return args.Error(0)
}

func (m *MockAssetRepository) GetAssetTypes(ctx context.Context) ([]model.AssetType, error) {
	args := m.Called(ctx)
	return args.Get(0).([]model.AssetType), args.Error(1)
}

func (m *MockAssetRepository) GetAssetsByTag(ctx context.Context, tagID int) ([]model.Asset, error) {
	args := m.Called(ctx, tagID)
	return args.Get(0).([]model.Asset), args.Error(1)
}

func (m *MockAssetRepository) Count(ctx context.Context, options ...repository.QueryOption) (int, error) {
	args := m.Called(ctx, options)
	return args.Int(0), args.Error(1)
}

func (m *MockAssetRepository) GetDB() bun.IDB {
	args := m.Called()
	return args.Get(0).(bun.IDB)
}

func (m *MockAssetRepository) FindOneBy(ctx context.Context, options ...repository.QueryOption) (model.Asset, error) {
	args := m.Called(ctx, options)
	return args.Get(0).(model.Asset), args.Error(1)
}

type MockPositionRepository struct {
	mock.Mock
}

func (m *MockPositionRepository) Create(ctx context.Context, entity *model.Position) (*model.Position, error) {
	args := m.Called(ctx, entity)
	return args.Get(0).(*model.Position), args.Error(1)
}

func (m *MockPositionRepository) GetByID(ctx context.Context, id uint) (model.Position, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(model.Position), args.Error(1)
}

func (m *MockPositionRepository) Update(ctx context.Context, entity *model.Position) error {
	args := m.Called(ctx, entity)
	return args.Error(0)
}

func (m *MockPositionRepository) Delete(ctx context.Context, id uint) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockPositionRepository) FindAllBy(ctx context.Context, options ...repository.QueryOption) ([]model.Position, error) {
	args := m.Called(ctx, options)
	return args.Get(0).([]model.Position), args.Error(1)
}

func (m *MockPositionRepository) GetByUUID(ctx context.Context, id uuid.UUID) (*model.Position, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Position), args.Error(1)
}

func (m *MockPositionRepository) GetByPortfolioAndAsset(ctx context.Context, portfolioID, assetID uuid.UUID) (*model.Position, error) {
	args := m.Called(ctx, portfolioID, assetID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Position), args.Error(1)
}

func (m *MockPositionRepository) FindWithFilters(ctx context.Context, filter repository.PositionFilter) ([]model.Position, error) {
	args := m.Called(ctx, filter)
	return args.Get(0).([]model.Position), args.Error(1)
}

func (m *MockPositionRepository) CountWithFilters(ctx context.Context, filter repository.PositionFilter) (int, error) {
	args := m.Called(ctx, filter)
	return args.Int(0), args.Error(1)
}

func (m *MockPositionRepository) GetPortfolioPositions(ctx context.Context, portfolioID uuid.UUID) ([]model.Position, error) {
	args := m.Called(ctx, portfolioID)
	return args.Get(0).([]model.Position), args.Error(1)
}

func (m *MockPositionRepository) GetPortfolioPositionsWithAssets(ctx context.Context, portfolioID uuid.UUID) ([]model.Position, error) {
	args := m.Called(ctx, portfolioID)
	return args.Get(0).([]model.Position), args.Error(1)
}

func (m *MockPositionRepository) GetPortfolioAggregation(ctx context.Context, portfolioID uuid.UUID) (*repository.PortfolioAggregation, error) {
	args := m.Called(ctx, portfolioID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*repository.PortfolioAggregation), args.Error(1)
}

func (m *MockPositionRepository) GetAssetAllocation(ctx context.Context, portfolioID uuid.UUID) ([]repository.AssetAllocation, error) {
	args := m.Called(ctx, portfolioID)
	return args.Get(0).([]repository.AssetAllocation), args.Error(1)
}

func (m *MockPositionRepository) GetPositionsRequiringPriceUpdate(ctx context.Context, assetIDs []uuid.UUID) ([]model.Position, error) {
	args := m.Called(ctx, assetIDs)
	return args.Get(0).([]model.Position), args.Error(1)
}

func (m *MockPositionRepository) GetEmptyPositions(ctx context.Context, portfolioID uuid.UUID) ([]model.Position, error) {
	args := m.Called(ctx, portfolioID)
	return args.Get(0).([]model.Position), args.Error(1)
}

func (m *MockPositionRepository) CreateBatch(ctx context.Context, positions []model.Position) error {
	args := m.Called(ctx, positions)
	return args.Error(0)
}

func (m *MockPositionRepository) UpdateBatch(ctx context.Context, positions []model.Position) error {
	args := m.Called(ctx, positions)
	return args.Error(0)
}

func (m *MockPositionRepository) DeleteEmptyPositions(ctx context.Context, portfolioID uuid.UUID) error {
	args := m.Called(ctx, portfolioID)
	return args.Error(0)
}

func (m *MockPositionRepository) Count(ctx context.Context, options ...repository.QueryOption) (int, error) {
	args := m.Called(ctx, options)
	return args.Int(0), args.Error(1)
}

func (m *MockPositionRepository) GetDB() bun.IDB {
	args := m.Called()
	return args.Get(0).(bun.IDB)
}

func (m *MockPositionRepository) FindOneBy(ctx context.Context, options ...repository.QueryOption) (model.Position, error) {
	args := m.Called(ctx, options)
	return args.Get(0).(model.Position), args.Error(1)
}

// Test AssetService

func TestAssetService_CreateAsset(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)
	ctx := context.Background()

	t.Run("successful stock asset creation", func(t *testing.T) {
		req := CreateAssetRequest{
			Type:   model.AssetTypeStock,
			Symbol: stringPtr("AAPL"),
			Name:   "Apple Inc.",
			Metadata: map[string]interface{}{
				"exchange": "NASDAQ",
				"sector":   "Technology",
			},
		}

		expectedAsset := &model.Asset{
			ID:          uuid.New(),
			Type:        model.AssetTypeStock,
			Symbol:      stringPtr("AAPL"),
			Name:        "Apple Inc.",
			IsTradeable: true,
		}

		// Mock symbol uniqueness check
		mockRepo.On("GetBySymbol", ctx, "AAPL").Return(nil, repository.ErrNotFound)
		mockRepo.On("Create", ctx, mock.AnythingOfType("*model.Asset")).Return(expectedAsset, nil)

		result, err := service.CreateAsset(ctx, req)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, model.AssetTypeStock, result.Type)
		assert.Equal(t, "Apple Inc.", result.Name)
		assert.True(t, result.IsTradeable)
		mockRepo.AssertExpectations(t)
	})

	t.Run("invalid asset type", func(t *testing.T) {
		req := CreateAssetRequest{
			Type: "INVALID",
			Name: "Test Asset",
		}

		result, err := service.CreateAsset(ctx, req)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "invalid asset type")
	})

	t.Run("missing symbol for tradeable asset", func(t *testing.T) {
		req := CreateAssetRequest{
			Type: model.AssetTypeStock,
			Name: "Apple Inc.",
		}

		result, err := service.CreateAsset(ctx, req)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "symbol is required")
	})
}

func TestAssetService_ValidateAssetData(t *testing.T) {
	mockRepo := new(MockAssetRepository)
	service := NewAssetService(mockRepo)
	ctx := context.Background()

	t.Run("valid stock metadata", func(t *testing.T) {
		metadata := map[string]interface{}{
			"exchange": "NASDAQ",
			"sector":   "Technology",
		}

		err := service.ValidateAssetData(ctx, model.AssetTypeStock, metadata)
		assert.NoError(t, err)
	})

	t.Run("invalid stock metadata - missing exchange", func(t *testing.T) {
		metadata := map[string]interface{}{
			"sector": "Technology",
		}

		err := service.ValidateAssetData(ctx, model.AssetTypeStock, metadata)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "exchange is required")
	})

	t.Run("valid crypto metadata", func(t *testing.T) {
		metadata := map[string]interface{}{
			"blockchain":     "ethereum",
			"wallet_address": "0x1234567890abcdef",
			"decimals":       18,
			"is_stablecoin":  false,
		}

		err := service.ValidateAssetData(ctx, model.AssetTypeCrypto, metadata)
		assert.NoError(t, err)
	})
}

// Test PositionService

func TestPositionService_CreatePosition(t *testing.T) {
	mockPositionRepo := new(MockPositionRepository)
	mockAssetRepo := new(MockAssetRepository)
	service := NewPositionService(mockPositionRepo, mockAssetRepo)
	ctx := context.Background()

	portfolioID := uuid.New()
	assetID := uuid.New()

	t.Run("successful position creation", func(t *testing.T) {
		req := CreatePositionRequest{
			PortfolioID: portfolioID,
			AssetID:     assetID,
			Quantity:    decimal.NewFromFloat(100),
		}

		asset := &model.Asset{
			ID:   assetID,
			Type: model.AssetTypeStock,
			Name: "Apple Inc.",
		}

		expectedPosition := &model.Position{
			ID:                  uuid.New(),
			PortfolioID:         portfolioID,
			AssetID:             assetID,
			Quantity:            decimal.NewFromFloat(100),
			OwnershipPercentage: decimal.NewFromInt(100),
		}

		mockAssetRepo.On("GetByUUID", ctx, assetID).Return(asset, nil)
		mockPositionRepo.On("GetByPortfolioAndAsset", ctx, portfolioID, assetID).Return(nil, repository.ErrNotFound)
		mockPositionRepo.On("Create", ctx, mock.AnythingOfType("*model.Position")).Return(expectedPosition, nil)

		result, err := service.CreatePosition(ctx, req)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, portfolioID, result.PortfolioID)
		assert.Equal(t, assetID, result.AssetID)
		assert.Equal(t, decimal.NewFromFloat(100), result.Quantity)
		mockAssetRepo.AssertExpectations(t)
		mockPositionRepo.AssertExpectations(t)
	})

	t.Run("position already exists", func(t *testing.T) {
		req := CreatePositionRequest{
			PortfolioID: portfolioID,
			AssetID:     assetID,
			Quantity:    decimal.NewFromFloat(100),
		}

		asset := &model.Asset{
			ID:   assetID,
			Type: model.AssetTypeStock,
			Name: "Apple Inc.",
		}

		existingPosition := &model.Position{
			ID:          uuid.New(),
			PortfolioID: portfolioID,
			AssetID:     assetID,
		}

		mockAssetRepo.On("GetByUUID", ctx, assetID).Return(asset, nil)
		mockPositionRepo.On("GetByPortfolioAndAsset", ctx, portfolioID, assetID).Return(existingPosition, nil)

		result, err := service.CreatePosition(ctx, req)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "position already exists")
		mockAssetRepo.AssertExpectations(t)
		mockPositionRepo.AssertExpectations(t)
	})
}

func TestPositionService_CalculatePositionValue(t *testing.T) {
	mockPositionRepo := new(MockPositionRepository)
	mockAssetRepo := new(MockAssetRepository)
	service := NewPositionService(mockPositionRepo, mockAssetRepo)
	ctx := context.Background()

	t.Run("calculate value with current price", func(t *testing.T) {
		position := &model.Position{
			ID:                  uuid.New(),
			Quantity:            decimal.NewFromFloat(100),
			OwnershipPercentage: decimal.NewFromInt(100),
			TotalCostBasis:      moneyPtr(10000), // $100.00 in cents
		}

		currentPrice := decimal.NewFromFloat(150) // $150 per share

		result, err := service.CalculatePositionValue(ctx, position, &currentPrice)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, position, result.Position)
		assert.Equal(t, &currentPrice, result.CurrentPrice)
		assert.Equal(t, model.Money(1500000), result.CurrentValue)       // 100 * $150 * 100 cents
		assert.Equal(t, model.Money(1490000), result.UnrealizedGainLoss) // $15000 - $100 = $14900
	})
}

// Helper functions

// Helper function for tests
func moneyPtr(amount int64) *model.Money {
	money := model.Money(amount)
	return &money
}
