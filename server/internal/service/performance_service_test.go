package service

import (
	"context"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/uptrace/bun"
)

// Mock repositories for testing
type MockPerformanceRepository struct {
	mock.Mock
}

func (m *MockPerformanceRepository) CalculatePortfolioPerformance(ctx context.Context, portfolioID uuid.UUID, asOfDate time.Time) (*repository.PerformanceMetrics, error) {
	args := m.Called(ctx, portfolioID, asOfDate)
	return args.Get(0).(*repository.PerformanceMetrics), args.Error(1)
}

func (m *MockPerformanceRepository) CalculateTimeWeightedReturn(ctx context.Context, portfolioID uuid.UUID, startDate, endDate time.Time) (decimal.Decimal, error) {
	args := m.Called(ctx, portfolioID, startDate, endDate)
	return args.Get(0).(decimal.Decimal), args.Error(1)
}

func (m *MockPerformanceRepository) CalculateVolatility(ctx context.Context, portfolioID uuid.UUID, days int) (decimal.Decimal, error) {
	args := m.Called(ctx, portfolioID, days)
	return args.Get(0).(decimal.Decimal), args.Error(1)
}

func (m *MockPerformanceRepository) CalculateMaxDrawdown(ctx context.Context, portfolioID uuid.UUID, startDate, endDate time.Time) (decimal.Decimal, error) {
	args := m.Called(ctx, portfolioID, startDate, endDate)
	return args.Get(0).(decimal.Decimal), args.Error(1)
}

func (m *MockPerformanceRepository) CalculateAssetAllocation(ctx context.Context, portfolioID uuid.UUID, asOfDate time.Time) (*repository.AllocationBreakdown, error) {
	args := m.Called(ctx, portfolioID, asOfDate)
	return args.Get(0).(*repository.AllocationBreakdown), args.Error(1)
}

func (m *MockPerformanceRepository) CalculateAllocationByType(ctx context.Context, portfolioID uuid.UUID) ([]repository.AssetAllocation, error) {
	args := m.Called(ctx, portfolioID)
	return args.Get(0).([]repository.AssetAllocation), args.Error(1)
}

func (m *MockPerformanceRepository) CalculateAllocationBySector(ctx context.Context, portfolioID uuid.UUID) ([]repository.AssetAllocation, error) {
	args := m.Called(ctx, portfolioID)
	return args.Get(0).([]repository.AssetAllocation), args.Error(1)
}

func (m *MockPerformanceRepository) CalculateAllocationByGeography(ctx context.Context, portfolioID uuid.UUID) ([]repository.AssetAllocation, error) {
	args := m.Called(ctx, portfolioID)
	return args.Get(0).([]repository.AssetAllocation), args.Error(1)
}

func (m *MockPerformanceRepository) CreatePerformanceSnapshot(ctx context.Context, snapshot *repository.PerformanceSnapshot) error {
	args := m.Called(ctx, snapshot)
	return args.Error(0)
}

func (m *MockPerformanceRepository) GetPerformanceSnapshots(ctx context.Context, portfolioID uuid.UUID, startDate, endDate time.Time) ([]repository.PerformanceSnapshot, error) {
	args := m.Called(ctx, portfolioID, startDate, endDate)
	return args.Get(0).([]repository.PerformanceSnapshot), args.Error(1)
}

func (m *MockPerformanceRepository) GetLatestPerformanceSnapshot(ctx context.Context, portfolioID uuid.UUID) (*repository.PerformanceSnapshot, error) {
	args := m.Called(ctx, portfolioID)
	return args.Get(0).(*repository.PerformanceSnapshot), args.Error(1)
}

func (m *MockPerformanceRepository) UpdatePerformanceSnapshots(ctx context.Context, portfolioIDs []uuid.UUID, asOfDate time.Time) error {
	args := m.Called(ctx, portfolioIDs, asOfDate)
	return args.Error(0)
}

func (m *MockPerformanceRepository) ComparePortfolioPerformance(ctx context.Context, portfolioIDs []uuid.UUID, startDate, endDate time.Time) (map[uuid.UUID]*repository.PerformanceMetrics, error) {
	args := m.Called(ctx, portfolioIDs, startDate, endDate)
	return args.Get(0).(map[uuid.UUID]*repository.PerformanceMetrics), args.Error(1)
}

func (m *MockPerformanceRepository) GetTopPerformingAssets(ctx context.Context, portfolioID uuid.UUID, limit int, timeRange repository.TimeRange) ([]model.Position, error) {
	args := m.Called(ctx, portfolioID, limit, timeRange)
	return args.Get(0).([]model.Position), args.Error(1)
}

func (m *MockPerformanceRepository) GetWorstPerformingAssets(ctx context.Context, portfolioID uuid.UUID, limit int, timeRange repository.TimeRange) ([]model.Position, error) {
	args := m.Called(ctx, portfolioID, limit, timeRange)
	return args.Get(0).([]model.Position), args.Error(1)
}

func (m *MockPerformanceRepository) CalculateBenchmarkComparison(ctx context.Context, portfolioID uuid.UUID, benchmarkAssetID uuid.UUID, timeRange repository.TimeRange) (*repository.BenchmarkComparison, error) {
	args := m.Called(ctx, portfolioID, benchmarkAssetID, timeRange)
	return args.Get(0).(*repository.BenchmarkComparison), args.Error(1)
}

type MockPriceRepository struct {
	mock.Mock
}

func (m *MockPriceRepository) GetLatestPrice(ctx context.Context, assetID uuid.UUID) (*model.AssetPrice, error) {
	args := m.Called(ctx, assetID)
	return args.Get(0).(*model.AssetPrice), args.Error(1)
}

func (m *MockPriceRepository) GetLatestPrices(ctx context.Context, assetIDs []uuid.UUID) ([]model.AssetPrice, error) {
	args := m.Called(ctx, assetIDs)
	return args.Get(0).([]model.AssetPrice), args.Error(1)
}

func (m *MockPriceRepository) GetPriceHistory(ctx context.Context, assetID uuid.UUID, timeRange repository.TimeRange) ([]model.AssetPrice, error) {
	args := m.Called(ctx, assetID, timeRange)
	return args.Get(0).([]model.AssetPrice), args.Error(1)
}

func (m *MockPriceRepository) FindWithFilters(ctx context.Context, filter repository.PriceFilter) ([]model.AssetPrice, error) {
	args := m.Called(ctx, filter)
	return args.Get(0).([]model.AssetPrice), args.Error(1)
}

func (m *MockPriceRepository) GetPricesByTimeRange(ctx context.Context, assetIDs []uuid.UUID, timeRange repository.TimeRange) ([]model.AssetPrice, error) {
	args := m.Called(ctx, assetIDs, timeRange)
	return args.Get(0).([]model.AssetPrice), args.Error(1)
}

func (m *MockPriceRepository) GetOHLCData(ctx context.Context, assetID uuid.UUID, timeRange repository.TimeRange, interval string) ([]repository.PriceAggregation, error) {
	args := m.Called(ctx, assetID, timeRange, interval)
	return args.Get(0).([]repository.PriceAggregation), args.Error(1)
}

func (m *MockPriceRepository) GetPriceStatistics(ctx context.Context, assetID uuid.UUID) (*repository.PriceStatistics, error) {
	args := m.Called(ctx, assetID)
	return args.Get(0).(*repository.PriceStatistics), args.Error(1)
}

func (m *MockPriceRepository) GetStaleAssets(ctx context.Context, maxAge time.Duration) ([]uuid.UUID, error) {
	args := m.Called(ctx, maxAge)
	return args.Get(0).([]uuid.UUID), args.Error(1)
}

func (m *MockPriceRepository) GetAssetsRequiringUpdate(ctx context.Context, sources []string) ([]uuid.UUID, error) {
	args := m.Called(ctx, sources)
	return args.Get(0).([]uuid.UUID), args.Error(1)
}

func (m *MockPriceRepository) GetPriceChanges(ctx context.Context, assetIDs []uuid.UUID, timeRange repository.TimeRange) (map[uuid.UUID]decimal.Decimal, error) {
	args := m.Called(ctx, assetIDs, timeRange)
	return args.Get(0).(map[uuid.UUID]decimal.Decimal), args.Error(1)
}

func (m *MockPriceRepository) UpsertPrices(ctx context.Context, prices []model.AssetPrice) error {
	args := m.Called(ctx, prices)
	return args.Error(0)
}

func (m *MockPriceRepository) DeleteOldPrices(ctx context.Context, assetID uuid.UUID, olderThan time.Time) error {
	args := m.Called(ctx, assetID, olderThan)
	return args.Error(0)
}

func (m *MockPriceRepository) GetSampledPriceData(ctx context.Context, assetID uuid.UUID, timeRange repository.TimeRange, maxPoints int) ([]model.AssetPrice, error) {
	args := m.Called(ctx, assetID, timeRange, maxPoints)
	return args.Get(0).([]model.AssetPrice), args.Error(1)
}

func (m *MockPriceRepository) GetVolumeWeightedAveragePrice(ctx context.Context, assetID uuid.UUID, timeRange repository.TimeRange) (*decimal.Decimal, error) {
	args := m.Called(ctx, assetID, timeRange)
	return args.Get(0).(*decimal.Decimal), args.Error(1)
}

// Implement base repository methods for MockPriceRepository
func (m *MockPriceRepository) Create(ctx context.Context, entity *model.AssetPrice) (*model.AssetPrice, error) {
	args := m.Called(ctx, entity)
	return args.Get(0).(*model.AssetPrice), args.Error(1)
}

func (m *MockPriceRepository) GetByID(ctx context.Context, id uint) (model.AssetPrice, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(model.AssetPrice), args.Error(1)
}

func (m *MockPriceRepository) Update(ctx context.Context, entity *model.AssetPrice) error {
	args := m.Called(ctx, entity)
	return args.Error(0)
}

func (m *MockPriceRepository) Delete(ctx context.Context, id uint) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockPriceRepository) List(ctx context.Context, limit, offset int) ([]model.AssetPrice, error) {
	args := m.Called(ctx, limit, offset)
	return args.Get(0).([]model.AssetPrice), args.Error(1)
}

func (m *MockPriceRepository) Count(ctx context.Context, options ...repository.QueryOption) (int, error) {
	args := m.Called(ctx, options)
	return args.Get(0).(int), args.Error(1)
}

func (m *MockPriceRepository) GetDB() bun.IDB {
	args := m.Called()
	return args.Get(0).(bun.IDB)
}

func (m *MockPriceRepository) FindOneBy(ctx context.Context, options ...repository.QueryOption) (model.AssetPrice, error) {
	args := m.Called(ctx, options)
	return args.Get(0).(model.AssetPrice), args.Error(1)
}

func (m *MockPriceRepository) FindAllBy(ctx context.Context, options ...repository.QueryOption) ([]model.AssetPrice, error) {
	args := m.Called(ctx, options)
	return args.Get(0).([]model.AssetPrice), args.Error(1)
}

// Use existing MockPositionRepository from asset_management_service_test.go

// Test setup helper
func setupPerformanceServiceTest() (*PerformanceService, *MockPerformanceRepository, *MockPriceRepository, *MockPositionRepository) {
	mockPerformanceRepo := &MockPerformanceRepository{}
	mockPriceRepo := &MockPriceRepository{}
	mockPositionRepo := &MockPositionRepository{}

	service := NewPerformanceService(mockPerformanceRepo, mockPriceRepo, mockPositionRepo)

	return service, mockPerformanceRepo, mockPriceRepo, mockPositionRepo
}

func TestPerformanceService_CalculatePortfolioPerformance(t *testing.T) {
	service, mockPerformanceRepo, _, _ := setupPerformanceServiceTest()
	ctx := context.Background()
	portfolioID := uuid.New()
	asOfDate := time.Now()

	t.Run("successful calculation", func(t *testing.T) {
		expectedMetrics := &repository.PerformanceMetrics{
			PortfolioID:           portfolioID,
			TotalValue:            model.Money(100000), // $1000.00
			TotalCostBasis:        model.Money(90000),  // $900.00
			UnrealizedGainLoss:    model.Money(10000),  // $100.00
			RealizedGainLoss:      model.Money(5000),   // $50.00
			TotalReturn:           decimal.NewFromInt(15000),
			TotalReturnPercentage: decimal.NewFromFloat(16.67),
			TimeWeightedReturn:    decimal.NewFromFloat(15.5),
			AnnualizedReturn:      decimal.NewFromFloat(18.2),
			Volatility:            decimal.NewFromFloat(12.5),
			SharpeRatio:           decimal.NewFromFloat(1.3),
			MaxDrawdown:           decimal.NewFromFloat(5.2),
			CalculationDate:       asOfDate,
		}

		mockPerformanceRepo.On("CalculatePortfolioPerformance", ctx, portfolioID, mock.AnythingOfType("time.Time")).
			Return(expectedMetrics, nil)

		result, err := service.CalculatePortfolioPerformance(ctx, portfolioID, &asOfDate)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, portfolioID, result.PortfolioID)
		assert.Equal(t, expectedMetrics.TotalValue, result.TotalValue)
		assert.Equal(t, expectedMetrics.TotalReturnPercentage, result.TotalReturnPercentage)
		assert.True(t, result.IsValid)
		assert.Empty(t, result.ValidationErrors)
		assert.Equal(t, "TIME_WEIGHTED_RETURN", result.CalculationMethod.Method)

		mockPerformanceRepo.AssertExpectations(t)
	})

	t.Run("invalid portfolio ID", func(t *testing.T) {
		result, err := service.CalculatePortfolioPerformance(ctx, uuid.Nil, &asOfDate)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "portfolio ID is required")
	})

	t.Run("uses current time when no date provided", func(t *testing.T) {
		expectedMetrics := &repository.PerformanceMetrics{
			PortfolioID:     portfolioID,
			TotalValue:      model.Money(100000),
			CalculationDate: time.Now(),
		}

		mockPerformanceRepo.On("CalculatePortfolioPerformance", ctx, portfolioID, mock.AnythingOfType("time.Time")).
			Return(expectedMetrics, nil)

		result, err := service.CalculatePortfolioPerformance(ctx, portfolioID, nil)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, portfolioID, result.PortfolioID)

		mockPerformanceRepo.AssertExpectations(t)
	})
}

func TestPerformanceService_CalculateTimeWeightedReturn(t *testing.T) {
	service, mockPerformanceRepo, _, _ := setupPerformanceServiceTest()
	ctx := context.Background()
	portfolioID := uuid.New()
	timeRange := PerformanceTimeRange{
		Start: time.Now().AddDate(0, -1, 0), // 1 month ago
		End:   time.Now(),
	}

	t.Run("successful calculation", func(t *testing.T) {
		expectedTWR := decimal.NewFromFloat(15.5)

		mockPerformanceRepo.On("CalculateTimeWeightedReturn", ctx, portfolioID, timeRange.Start, timeRange.End).
			Return(expectedTWR, nil)

		result, err := service.CalculateTimeWeightedReturn(ctx, portfolioID, timeRange)

		assert.NoError(t, err)
		assert.Equal(t, expectedTWR, result)

		mockPerformanceRepo.AssertExpectations(t)
	})

	t.Run("invalid portfolio ID", func(t *testing.T) {
		result, err := service.CalculateTimeWeightedReturn(ctx, uuid.Nil, timeRange)

		assert.Error(t, err)
		assert.Equal(t, decimal.Zero, result)
		assert.Contains(t, err.Error(), "portfolio ID is required")
	})

	t.Run("invalid time range - start after end", func(t *testing.T) {
		invalidTimeRange := PerformanceTimeRange{
			Start: time.Now(),
			End:   time.Now().AddDate(0, -1, 0), // End before start
		}

		result, err := service.CalculateTimeWeightedReturn(ctx, portfolioID, invalidTimeRange)

		assert.Error(t, err)
		assert.Equal(t, decimal.Zero, result)
		assert.Contains(t, err.Error(), "start date must be before end date")
	})

	t.Run("invalid time range - future end date", func(t *testing.T) {
		futureTimeRange := PerformanceTimeRange{
			Start: time.Now(),
			End:   time.Now().AddDate(0, 1, 0), // Future end date
		}

		result, err := service.CalculateTimeWeightedReturn(ctx, portfolioID, futureTimeRange)

		assert.Error(t, err)
		assert.Equal(t, decimal.Zero, result)
		assert.Contains(t, err.Error(), "end date cannot be in the future")
	})
}

func TestPerformanceService_CalculateVolatility(t *testing.T) {
	service, mockPerformanceRepo, _, _ := setupPerformanceServiceTest()
	ctx := context.Background()
	portfolioID := uuid.New()
	days := 30

	t.Run("successful calculation", func(t *testing.T) {
		expectedVolatility := decimal.NewFromFloat(12.5)

		mockPerformanceRepo.On("CalculateVolatility", ctx, portfolioID, days).
			Return(expectedVolatility, nil)

		result, err := service.CalculateVolatility(ctx, portfolioID, days)

		assert.NoError(t, err)
		assert.Equal(t, expectedVolatility, result)

		mockPerformanceRepo.AssertExpectations(t)
	})

	t.Run("invalid portfolio ID", func(t *testing.T) {
		result, err := service.CalculateVolatility(ctx, uuid.Nil, days)

		assert.Error(t, err)
		assert.Equal(t, decimal.Zero, result)
		assert.Contains(t, err.Error(), "portfolio ID is required")
	})

	t.Run("invalid days - zero", func(t *testing.T) {
		result, err := service.CalculateVolatility(ctx, portfolioID, 0)

		assert.Error(t, err)
		assert.Equal(t, decimal.Zero, result)
		assert.Contains(t, err.Error(), "days must be positive")
	})

	t.Run("invalid days - negative", func(t *testing.T) {
		result, err := service.CalculateVolatility(ctx, portfolioID, -10)

		assert.Error(t, err)
		assert.Equal(t, decimal.Zero, result)
		assert.Contains(t, err.Error(), "days must be positive")
	})
}

func TestPerformanceService_CalculateSharpeRatio(t *testing.T) {
	service, mockPerformanceRepo, _, _ := setupPerformanceServiceTest()
	ctx := context.Background()
	portfolioID := uuid.New()
	riskFreeRate := decimal.NewFromFloat(2.0)
	days := 30

	t.Run("successful calculation", func(t *testing.T) {
		portfolioReturn := decimal.NewFromFloat(15.0)
		volatility := decimal.NewFromFloat(12.5)
		expectedSharpeRatio := decimal.NewFromFloat(1.04) // (15-2)/12.5

		// Mock the time-weighted return calculation
		mockPerformanceRepo.On("CalculateTimeWeightedReturn", ctx, portfolioID, mock.AnythingOfType("time.Time"), mock.AnythingOfType("time.Time")).
			Return(portfolioReturn, nil)

		// Mock the volatility calculation
		mockPerformanceRepo.On("CalculateVolatility", ctx, portfolioID, days).
			Return(volatility, nil)

		result, err := service.CalculateSharpeRatio(ctx, portfolioID, riskFreeRate, days)

		assert.NoError(t, err)
		assert.True(t, result.Sub(expectedSharpeRatio).Abs().LessThan(decimal.NewFromFloat(0.01))) // Allow small rounding differences

		mockPerformanceRepo.AssertExpectations(t)
	})

	t.Run("zero volatility returns zero", func(t *testing.T) {
		portfolioReturn := decimal.NewFromFloat(15.0)
		volatility := decimal.Zero

		mockPerformanceRepo.On("CalculateTimeWeightedReturn", ctx, portfolioID, mock.AnythingOfType("time.Time"), mock.AnythingOfType("time.Time")).
			Return(portfolioReturn, nil)

		mockPerformanceRepo.On("CalculateVolatility", ctx, portfolioID, days).
			Return(volatility, nil)

		result, err := service.CalculateSharpeRatio(ctx, portfolioID, riskFreeRate, days)

		assert.NoError(t, err)
		assert.Equal(t, decimal.Zero, result)

		mockPerformanceRepo.AssertExpectations(t)
	})

	t.Run("invalid portfolio ID", func(t *testing.T) {
		result, err := service.CalculateSharpeRatio(ctx, uuid.Nil, riskFreeRate, days)

		assert.Error(t, err)
		assert.Equal(t, decimal.Zero, result)
		assert.Contains(t, err.Error(), "portfolio ID is required")
	})
}

func TestPerformanceService_CalculateAssetAllocation(t *testing.T) {
	service, mockPerformanceRepo, _, _ := setupPerformanceServiceTest()
	ctx := context.Background()
	portfolioID := uuid.New()
	asOfDate := time.Now()

	t.Run("successful calculation", func(t *testing.T) {
		expectedAllocations := []repository.AssetAllocation{
			{
				AssetType:     model.AssetTypeStock,
				PositionCount: 5,
				TotalQuantity: decimal.NewFromInt(100),
				Percentage:    decimal.NewFromFloat(60.0),
			},
			{
				AssetType:     model.AssetTypeCrypto,
				PositionCount: 2,
				TotalQuantity: decimal.NewFromInt(50),
				Percentage:    decimal.NewFromFloat(40.0),
			},
		}

		expectedBreakdown := &repository.AllocationBreakdown{
			PortfolioID:     portfolioID,
			TotalValue:      model.Money(100000),
			Allocations:     expectedAllocations,
			CalculationDate: asOfDate,
		}

		mockPerformanceRepo.On("CalculateAssetAllocation", ctx, portfolioID, mock.AnythingOfType("time.Time")).
			Return(expectedBreakdown, nil)

		result, err := service.CalculateAssetAllocation(ctx, portfolioID, &asOfDate)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, portfolioID, result.PortfolioID)
		assert.Equal(t, expectedBreakdown.TotalValue, result.TotalValue)
		assert.Len(t, result.Allocations, 2)
		assert.True(t, result.DiversificationScore.GreaterThan(decimal.Zero))

		mockPerformanceRepo.AssertExpectations(t)
	})

	t.Run("invalid portfolio ID", func(t *testing.T) {
		result, err := service.CalculateAssetAllocation(ctx, uuid.Nil, &asOfDate)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "portfolio ID is required")
	})

	t.Run("uses current time when no date provided", func(t *testing.T) {
		expectedBreakdown := &repository.AllocationBreakdown{
			PortfolioID: portfolioID,
			TotalValue:  model.Money(100000),
			Allocations: []repository.AssetAllocation{},
		}

		mockPerformanceRepo.On("CalculateAssetAllocation", ctx, portfolioID, mock.AnythingOfType("time.Time")).
			Return(expectedBreakdown, nil)

		result, err := service.CalculateAssetAllocation(ctx, portfolioID, nil)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, portfolioID, result.PortfolioID)

		mockPerformanceRepo.AssertExpectations(t)
	})
}

func TestPerformanceService_CreatePerformanceSnapshot(t *testing.T) {
	service, mockPerformanceRepo, _, _ := setupPerformanceServiceTest()
	ctx := context.Background()
	portfolioID := uuid.New()
	asOfDate := time.Now()

	t.Run("successful creation", func(t *testing.T) {
		expectedMetrics := &repository.PerformanceMetrics{
			PortfolioID:           portfolioID,
			TotalValue:            model.Money(100000),
			TotalCostBasis:        model.Money(90000),
			UnrealizedGainLoss:    model.Money(10000),
			RealizedGainLoss:      model.Money(5000),
			TotalReturnPercentage: decimal.NewFromFloat(16.67),
			CalculationDate:       asOfDate,
		}

		// Mock the performance calculation
		mockPerformanceRepo.On("CalculatePortfolioPerformance", ctx, portfolioID, mock.AnythingOfType("time.Time")).
			Return(expectedMetrics, nil)

		// Mock the snapshot creation
		mockPerformanceRepo.On("CreatePerformanceSnapshot", ctx, mock.AnythingOfType("*repository.PerformanceSnapshot")).
			Return(nil)

		result, err := service.CreatePerformanceSnapshot(ctx, portfolioID, asOfDate)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, portfolioID, result.PortfolioID)
		assert.Equal(t, expectedMetrics.TotalValue, result.TotalValue)
		assert.Equal(t, expectedMetrics.TotalReturnPercentage, result.ReturnPercentage)

		mockPerformanceRepo.AssertExpectations(t)
	})

	t.Run("invalid portfolio ID", func(t *testing.T) {
		result, err := service.CreatePerformanceSnapshot(ctx, uuid.Nil, asOfDate)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "portfolio ID is required")
	})
}

func TestPerformanceService_GetTopPerformingAssets(t *testing.T) {
	service, mockPerformanceRepo, _, _ := setupPerformanceServiceTest()
	ctx := context.Background()
	portfolioID := uuid.New()
	limit := 5
	timeRange := PerformanceTimeRange{
		Start: time.Now().AddDate(0, -1, 0),
		End:   time.Now(),
	}

	t.Run("successful retrieval", func(t *testing.T) {
		expectedPositions := []model.Position{
			{
				ID:          uuid.New(),
				PortfolioID: portfolioID,
				AssetID:     uuid.New(),
				Quantity:    decimal.NewFromInt(100),
			},
			{
				ID:          uuid.New(),
				PortfolioID: portfolioID,
				AssetID:     uuid.New(),
				Quantity:    decimal.NewFromInt(50),
			},
		}

		repoTimeRange := repository.TimeRange{
			Start: timeRange.Start,
			End:   timeRange.End,
		}

		mockPerformanceRepo.On("GetTopPerformingAssets", ctx, portfolioID, limit, repoTimeRange).
			Return(expectedPositions, nil)

		result, err := service.GetTopPerformingAssets(ctx, portfolioID, limit, timeRange)

		assert.NoError(t, err)
		assert.Len(t, result, 2)
		assert.Equal(t, expectedPositions[0].ID, result[0].ID)
		assert.Equal(t, expectedPositions[1].ID, result[1].ID)

		mockPerformanceRepo.AssertExpectations(t)
	})

	t.Run("invalid portfolio ID", func(t *testing.T) {
		result, err := service.GetTopPerformingAssets(ctx, uuid.Nil, limit, timeRange)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "portfolio ID is required")
	})

	t.Run("uses default limit when zero provided", func(t *testing.T) {
		expectedPositions := []model.Position{}

		repoTimeRange := repository.TimeRange{
			Start: timeRange.Start,
			End:   timeRange.End,
		}

		mockPerformanceRepo.On("GetTopPerformingAssets", ctx, portfolioID, 10, repoTimeRange). // Default limit is 10
													Return(expectedPositions, nil)

		result, err := service.GetTopPerformingAssets(ctx, portfolioID, 0, timeRange)

		assert.NoError(t, err)
		assert.NotNil(t, result)

		mockPerformanceRepo.AssertExpectations(t)
	})
}

func TestPerformanceService_CalculateRiskMetrics(t *testing.T) {
	service, mockPerformanceRepo, _, _ := setupPerformanceServiceTest()
	ctx := context.Background()
	portfolioID := uuid.New()
	timeRange := PerformanceTimeRange{
		Start: time.Now().AddDate(0, -1, 0),
		End:   time.Now(),
	}

	t.Run("successful calculation", func(t *testing.T) {
		days := int(timeRange.End.Sub(timeRange.Start).Hours() / 24)

		// Mock volatility calculation
		expectedVolatility := decimal.NewFromFloat(12.5)
		mockPerformanceRepo.On("CalculateVolatility", ctx, portfolioID, days).
			Return(expectedVolatility, nil)

		// Mock time-weighted return for Sharpe ratio
		expectedReturn := decimal.NewFromFloat(15.0)
		mockPerformanceRepo.On("CalculateTimeWeightedReturn", ctx, portfolioID, mock.AnythingOfType("time.Time"), mock.AnythingOfType("time.Time")).
			Return(expectedReturn, nil)

		// Mock max drawdown calculation
		expectedMaxDrawdown := decimal.NewFromFloat(5.2)
		mockPerformanceRepo.On("CalculateMaxDrawdown", ctx, portfolioID, timeRange.Start, timeRange.End).
			Return(expectedMaxDrawdown, nil)

		result, err := service.CalculateRiskMetrics(ctx, portfolioID, timeRange)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, expectedVolatility, result.Volatility)
		assert.Equal(t, expectedMaxDrawdown, result.MaxDrawdown)
		assert.True(t, result.SharpeRatio.GreaterThan(decimal.Zero))

		mockPerformanceRepo.AssertExpectations(t)
	})

	t.Run("invalid portfolio ID", func(t *testing.T) {
		result, err := service.CalculateRiskMetrics(ctx, uuid.Nil, timeRange)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "portfolio ID is required")
	})
}

func TestPerformanceService_GeneratePerformanceReport(t *testing.T) {
	service, mockPerformanceRepo, _, _ := setupPerformanceServiceTest()
	ctx := context.Background()
	portfolioID := uuid.New()
	reportType := ReportTypeMonthly
	timeRange := PerformanceTimeRange{
		Start: time.Now().AddDate(0, -1, 0),
		End:   time.Now(),
	}

	t.Run("successful report generation", func(t *testing.T) {
		// Mock performance metrics
		expectedMetrics := &repository.PerformanceMetrics{
			PortfolioID:           portfolioID,
			TotalValue:            model.Money(100000),
			TotalReturnPercentage: decimal.NewFromFloat(16.67),
		}
		mockPerformanceRepo.On("CalculatePortfolioPerformance", ctx, portfolioID, mock.AnythingOfType("time.Time")).
			Return(expectedMetrics, nil)

		// Mock asset allocation
		expectedAllocation := &repository.AllocationBreakdown{
			PortfolioID: portfolioID,
			TotalValue:  model.Money(100000),
			Allocations: []repository.AssetAllocation{},
		}
		mockPerformanceRepo.On("CalculateAssetAllocation", ctx, portfolioID, mock.AnythingOfType("time.Time")).
			Return(expectedAllocation, nil)

		// Mock volatility for risk metrics
		mockPerformanceRepo.On("CalculateVolatility", ctx, portfolioID, mock.AnythingOfType("int")).
			Return(decimal.NewFromFloat(12.5), nil)

		// Mock time-weighted return for risk metrics
		mockPerformanceRepo.On("CalculateTimeWeightedReturn", ctx, portfolioID, mock.AnythingOfType("time.Time"), mock.AnythingOfType("time.Time")).
			Return(decimal.NewFromFloat(15.0), nil)

		// Mock max drawdown for risk metrics
		mockPerformanceRepo.On("CalculateMaxDrawdown", ctx, portfolioID, timeRange.Start, timeRange.End).
			Return(decimal.NewFromFloat(5.2), nil)

		// Mock top and worst performers
		repoTimeRange := repository.TimeRange{Start: timeRange.Start, End: timeRange.End}
		mockPerformanceRepo.On("GetTopPerformingAssets", ctx, portfolioID, 5, repoTimeRange).
			Return([]model.Position{}, nil)
		mockPerformanceRepo.On("GetWorstPerformingAssets", ctx, portfolioID, 5, repoTimeRange).
			Return([]model.Position{}, nil)

		result, err := service.GeneratePerformanceReport(ctx, portfolioID, reportType, timeRange)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, portfolioID, result.PortfolioID)
		assert.Equal(t, reportType, result.ReportType)
		assert.Equal(t, timeRange, result.TimeRange)
		assert.NotNil(t, result.Metrics)
		assert.NotNil(t, result.Allocation)
		assert.NotNil(t, result.RiskMetrics)
		assert.NotEmpty(t, result.Recommendations)

		mockPerformanceRepo.AssertExpectations(t)
	})

	t.Run("invalid portfolio ID", func(t *testing.T) {
		result, err := service.GeneratePerformanceReport(ctx, uuid.Nil, reportType, timeRange)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "portfolio ID is required")
	})
}

func TestPerformanceService_ValidateTimeRange(t *testing.T) {
	service, _, _, _ := setupPerformanceServiceTest()

	t.Run("valid time range", func(t *testing.T) {
		timeRange := PerformanceTimeRange{
			Start: time.Now().AddDate(0, -1, 0),
			End:   time.Now(),
		}

		err := service.validateTimeRange(timeRange)
		assert.NoError(t, err)
	})

	t.Run("zero start date", func(t *testing.T) {
		timeRange := PerformanceTimeRange{
			Start: time.Time{},
			End:   time.Now(),
		}

		err := service.validateTimeRange(timeRange)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "start and end dates are required")
	})

	t.Run("zero end date", func(t *testing.T) {
		timeRange := PerformanceTimeRange{
			Start: time.Now().AddDate(0, -1, 0),
			End:   time.Time{},
		}

		err := service.validateTimeRange(timeRange)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "start and end dates are required")
	})

	t.Run("start after end", func(t *testing.T) {
		timeRange := PerformanceTimeRange{
			Start: time.Now(),
			End:   time.Now().AddDate(0, -1, 0),
		}

		err := service.validateTimeRange(timeRange)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "start date must be before end date")
	})

	t.Run("future end date", func(t *testing.T) {
		timeRange := PerformanceTimeRange{
			Start: time.Now(),
			End:   time.Now().AddDate(0, 1, 0),
		}

		err := service.validateTimeRange(timeRange)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "end date cannot be in the future")
	})
}

func TestPerformanceService_CalculateDiversificationScore(t *testing.T) {
	service, _, _, _ := setupPerformanceServiceTest()

	t.Run("well diversified portfolio", func(t *testing.T) {
		allocations := []repository.AssetAllocation{
			{Percentage: decimal.NewFromFloat(25.0)}, // 25%
			{Percentage: decimal.NewFromFloat(25.0)}, // 25%
			{Percentage: decimal.NewFromFloat(25.0)}, // 25%
			{Percentage: decimal.NewFromFloat(25.0)}, // 25%
		}

		score := service.calculateDiversificationScore(allocations)
		assert.True(t, score.GreaterThan(decimal.NewFromFloat(70))) // Should be well diversified
	})

	t.Run("concentrated portfolio", func(t *testing.T) {
		allocations := []repository.AssetAllocation{
			{Percentage: decimal.NewFromFloat(90.0)}, // 90%
			{Percentage: decimal.NewFromFloat(10.0)}, // 10%
		}

		score := service.calculateDiversificationScore(allocations)
		assert.True(t, score.LessThan(decimal.NewFromFloat(50))) // Should be poorly diversified
	})

	t.Run("empty allocations", func(t *testing.T) {
		allocations := []repository.AssetAllocation{}

		score := service.calculateDiversificationScore(allocations)
		assert.Equal(t, decimal.Zero, score)
	})
}
