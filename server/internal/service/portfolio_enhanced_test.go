package service

import (
	"context"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/uptrace/bun"
)

func TestDuplicatePortfolio_Success(t *testing.T) {
	// Setup
	mockUOW := &MockUnitOfWork{}
	mockPortfolioRepo := &MockPortfolioRepository{}
	mockPortfolioAssetRepo := &MockPortfolioAssetRepository{}
	mockUserRepo := &MockUserRepository{}

	mockUOW.On("Portfolio").Return(mockPortfolioRepo)
	mockUOW.On("PortfolioAsset").Return(mockPortfolioAssetRepo)
	mockUOW.On("User").Return(mockUserRepo)

	service := NewPortfolioService(mockUOW)
	ctx := context.Background()

	// Test data
	sourcePortfolio := model.Portfolio{
		ID:          1,
		UserID:      1,
		Name:        "Original Portfolio",
		Description: "Original description",
		SortOrder:   0,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	input := DuplicatePortfolioInput{
		SourcePortfolioID: 1,
		NewName:           "Duplicated Portfolio",
		Description:       "Duplicated description",
		CopyAssets:        false, // Don't copy assets to simplify the test
	}

	expectedPortfolio := model.Portfolio{
		ID:          2,
		UserID:      1,
		Name:        "Duplicated Portfolio",
		Description: "Duplicated description",
		SortOrder:   1,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Mock expectations
	mockPortfolioRepo.On("GetByID", ctx, uint(1)).Return(sourcePortfolio, nil)
	mockPortfolioRepo.On("FindAllBy", ctx, mock.Anything).Return([]model.Portfolio{}, nil).Once()                // For duplicate name check (empty = no duplicates)
	mockPortfolioRepo.On("FindAllBy", ctx, mock.Anything).Return([]model.Portfolio{sourcePortfolio}, nil).Once() // For sort order calculation
	mockPortfolioRepo.On("Create", ctx, mock.AnythingOfType("*model.Portfolio")).Return(&expectedPortfolio, nil)

	// Execute
	result, err := service.DuplicatePortfolio(ctx, input)

	// Assert
	assert.NoError(t, err)
	assert.Equal(t, expectedPortfolio.Name, result.Name)
	assert.Equal(t, expectedPortfolio.Description, result.Description)
	assert.Equal(t, expectedPortfolio.UserID, result.UserID)
	mockPortfolioRepo.AssertExpectations(t)
}

func TestDuplicatePortfolio_InvalidInput(t *testing.T) {
	// Setup
	mockUOW := &MockUnitOfWork{}
	service := NewPortfolioService(mockUOW)
	ctx := context.Background()

	tests := []struct {
		name        string
		input       DuplicatePortfolioInput
		expectedErr string
	}{
		{
			name: "Name too short",
			input: DuplicatePortfolioInput{
				SourcePortfolioID: 1,
				NewName:           "AB", // Too short
				Description:       "Valid description",
				CopyAssets:        false,
			},
			expectedErr: "portfolio name must be at least 3 characters long",
		},
		{
			name: "Name too long",
			input: DuplicatePortfolioInput{
				SourcePortfolioID: 1,
				NewName:           string(make([]byte, 101)), // Too long
				Description:       "Valid description",
				CopyAssets:        false,
			},
			expectedErr: "portfolio name must be less than 100 characters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := service.DuplicatePortfolio(ctx, tt.input)
			assert.Error(t, err)
			assert.Contains(t, err.Error(), tt.expectedErr)
			assert.Equal(t, model.Portfolio{}, result)
		})
	}
}

func TestReorderPortfolios_Success(t *testing.T) {
	// Setup
	mockUOW := &MockUnitOfWork{}
	mockPortfolioRepo := &MockPortfolioRepository{}

	mockUOW.On("Portfolio").Return(mockPortfolioRepo)

	service := NewPortfolioService(mockUOW)
	ctx := context.Background()

	// Test data
	portfolio1 := model.Portfolio{
		ID:        1,
		UserID:    1,
		Name:      "Portfolio 1",
		SortOrder: 0,
	}

	portfolio2 := model.Portfolio{
		ID:        2,
		UserID:    1,
		Name:      "Portfolio 2",
		SortOrder: 1,
	}

	orders := []PortfolioOrderInput{
		{PortfolioID: 1, SortOrder: 1},
		{PortfolioID: 2, SortOrder: 0},
	}

	// Mock expectations
	mockPortfolioRepo.On("GetByID", ctx, uint(1)).Return(portfolio1, nil)
	mockPortfolioRepo.On("GetByID", ctx, uint(2)).Return(portfolio2, nil)
	mockPortfolioRepo.On("Update", ctx, mock.AnythingOfType("*model.Portfolio")).Return(nil).Twice()

	// Execute
	result, err := service.ReorderPortfolios(ctx, 1, orders)

	// Assert
	assert.NoError(t, err)
	assert.Len(t, result, 2)
	assert.Equal(t, 1, result[0].SortOrder) // Portfolio 1 should have sort order 1
	assert.Equal(t, 0, result[1].SortOrder) // Portfolio 2 should have sort order 0
	mockPortfolioRepo.AssertExpectations(t)
}

func TestGetPortfoliosByUser_Success(t *testing.T) {
	// Setup
	mockUOW := &MockUnitOfWork{}
	mockPortfolioRepo := &MockPortfolioRepository{}

	mockUOW.On("Portfolio").Return(mockPortfolioRepo)

	service := NewPortfolioService(mockUOW)
	ctx := context.Background()

	expectedPortfolios := []model.Portfolio{
		{
			ID:        1,
			UserID:    1,
			Name:      "Portfolio A",
			SortOrder: 0,
		},
		{
			ID:        2,
			UserID:    1,
			Name:      "Portfolio B",
			SortOrder: 1,
		},
	}

	// Mock expectations
	mockPortfolioRepo.On("FindAllBy", ctx, mock.Anything).Return(expectedPortfolios, nil)

	// Execute
	result, err := service.GetPortfoliosByUser(ctx, 1, "name")

	// Assert
	assert.NoError(t, err)
	assert.Len(t, result, 2)
	assert.Equal(t, expectedPortfolios, result)
	mockPortfolioRepo.AssertExpectations(t)
}

// MockPortfolioRepository for testing
type MockPortfolioRepository struct {
	mock.Mock
}

func (m *MockPortfolioRepository) GetByID(ctx context.Context, id uint) (model.Portfolio, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(model.Portfolio), args.Error(1)
}

func (m *MockPortfolioRepository) FindAllBy(ctx context.Context, opts ...repository.QueryOption) ([]model.Portfolio, error) {
	args := m.Called(ctx, opts)
	return args.Get(0).([]model.Portfolio), args.Error(1)
}

func (m *MockPortfolioRepository) Create(ctx context.Context, entity *model.Portfolio) (*model.Portfolio, error) {
	args := m.Called(ctx, entity)
	return args.Get(0).(*model.Portfolio), args.Error(1)
}

func (m *MockPortfolioRepository) Update(ctx context.Context, entity *model.Portfolio) error {
	args := m.Called(ctx, entity)
	return args.Error(0)
}

func (m *MockPortfolioRepository) Delete(ctx context.Context, id uint) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockPortfolioRepository) FindOneBy(ctx context.Context, options ...repository.QueryOption) (model.Portfolio, error) {
	args := m.Called(ctx, options)
	return args.Get(0).(model.Portfolio), args.Error(1)
}

func (m *MockPortfolioRepository) Count(ctx context.Context, options ...repository.QueryOption) (int, error) {
	args := m.Called(ctx, options)
	return args.Int(0), args.Error(1)
}

func (m *MockPortfolioRepository) GetDB() bun.IDB {
	args := m.Called()
	return args.Get(0).(bun.IDB)
}
func TestGetPortfolioAnalytics_Success(t *testing.T) {
	// Setup
	mockUOW := &MockUnitOfWork{}
	mockPortfolioRepo := &MockPortfolioRepository{}
	mockPortfolioAssetRepo := &MockPortfolioAssetRepository{}

	mockUOW.On("Portfolio").Return(mockPortfolioRepo)
	mockUOW.On("PortfolioAsset").Return(mockPortfolioAssetRepo)

	service := NewPortfolioService(mockUOW)
	ctx := context.Background()

	// Test data
	portfolio := model.Portfolio{
		ID:          1,
		UserID:      1,
		Name:        "Test Portfolio",
		Description: "Test description",
		SortOrder:   0,
	}

	portfolioAssets := []model.PortfolioAsset{
		{
			PortfolioID:          1,
			AssetID:              1,
			Quantity:             10.0,
			AveragePurchasePrice: 100.0,
		},
		{
			PortfolioID:          1,
			AssetID:              2,
			Quantity:             5.0,
			AveragePurchasePrice: 200.0,
		},
	}

	// Mock expectations
	mockPortfolioRepo.On("GetByID", ctx, uint(1)).Return(portfolio, nil)
	mockPortfolioAssetRepo.On("FindByPortfolioID", ctx, 1).Return(portfolioAssets, nil)

	// Execute
	result, err := service.GetPortfolioAnalytics(ctx, 1)

	// Assert
	assert.NoError(t, err)
	assert.Equal(t, 1, result.PortfolioID)
	assert.Equal(t, 2000.0, result.TotalValue) // (10 * 100) + (5 * 200)
	assert.Equal(t, 2000.0, result.TotalCost)  // Same as total value in this test
	assert.Equal(t, 0.0, result.TotalGainLoss) // No gain/loss
	assert.Equal(t, 0.0, result.TotalGainLossPercent)
	assert.Len(t, result.AssetAllocation, 1) // All assets are "UNKNOWN" type
	assert.NotNil(t, result.RiskMetrics)
	assert.Len(t, result.PerformanceHistory, 30) // 30 days of history

	mockPortfolioRepo.AssertExpectations(t)
	mockPortfolioAssetRepo.AssertExpectations(t)
}

func TestGetPortfolioAnalytics_EmptyPortfolio(t *testing.T) {
	// Setup
	mockUOW := &MockUnitOfWork{}
	mockPortfolioRepo := &MockPortfolioRepository{}
	mockPortfolioAssetRepo := &MockPortfolioAssetRepository{}

	mockUOW.On("Portfolio").Return(mockPortfolioRepo)
	mockUOW.On("PortfolioAsset").Return(mockPortfolioAssetRepo)

	service := NewPortfolioService(mockUOW)
	ctx := context.Background()

	// Test data
	portfolio := model.Portfolio{
		ID:          1,
		UserID:      1,
		Name:        "Empty Portfolio",
		Description: "Empty test portfolio",
		SortOrder:   0,
	}

	// Mock expectations
	mockPortfolioRepo.On("GetByID", ctx, uint(1)).Return(portfolio, nil)
	mockPortfolioAssetRepo.On("FindByPortfolioID", ctx, 1).Return([]model.PortfolioAsset{}, nil)

	// Execute
	result, err := service.GetPortfolioAnalytics(ctx, 1)

	// Assert
	assert.NoError(t, err)
	assert.Equal(t, 1, result.PortfolioID)
	assert.Equal(t, 0.0, result.TotalValue)
	assert.Equal(t, 0.0, result.TotalCost)
	assert.Equal(t, 0.0, result.TotalGainLoss)
	assert.Equal(t, 0.0, result.TotalGainLossPercent)
	assert.Len(t, result.AssetAllocation, 0)

	mockPortfolioRepo.AssertExpectations(t)
	mockPortfolioAssetRepo.AssertExpectations(t)
}

func TestGetPortfolioAnalytics_PortfolioNotFound(t *testing.T) {
	// Setup
	mockUOW := &MockUnitOfWork{}
	mockPortfolioRepo := &MockPortfolioRepository{}

	mockUOW.On("Portfolio").Return(mockPortfolioRepo)

	service := NewPortfolioService(mockUOW)
	ctx := context.Background()

	// Mock expectations
	mockPortfolioRepo.On("GetByID", ctx, uint(999)).Return(model.Portfolio{}, repository.ErrNotFound)

	// Execute
	result, err := service.GetPortfolioAnalytics(ctx, 999)

	// Assert
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "portfolio with ID 999 not found")
	assert.Equal(t, PortfolioAnalytics{}, result)

	mockPortfolioRepo.AssertExpectations(t)
}
