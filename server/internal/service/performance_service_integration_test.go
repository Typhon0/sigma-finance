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
)

func TestPerformanceService_Integration(t *testing.T) {
	// Create mock repositories
	mockPerformanceRepo := &MockPerformanceRepository{}
	mockPriceRepo := &MockPriceRepository{}
	mockPositionRepo := &MockPositionRepository{}

	// Create service
	service := NewPerformanceService(mockPerformanceRepo, mockPriceRepo, mockPositionRepo)

	// Test basic service creation
	assert.NotNil(t, service)
	assert.NotNil(t, service.performanceRepo)
	assert.NotNil(t, service.priceRepo)
	assert.NotNil(t, service.positionRepo)
}

func TestPerformanceService_CalculatePortfolioPerformance_Integration(t *testing.T) {
	// Create mock repositories
	mockPerformanceRepo := &MockPerformanceRepository{}
	mockPriceRepo := &MockPriceRepository{}
	mockPositionRepo := &MockPositionRepository{}

	// Create service
	service := NewPerformanceService(mockPerformanceRepo, mockPriceRepo, mockPositionRepo)

	ctx := context.Background()
	portfolioID := uuid.NewString()
	asOfDate := time.Now()

	// Mock expected repository response
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

	mockPerformanceRepo.On("CalculatePortfolioPerformance", ctx, portfolioID, asOfDate).
		Return(expectedMetrics, nil)

	mockPerformanceRepo.On("GetPerformanceSnapshots", ctx, portfolioID, mock.Anything, mock.Anything).
		Return([]repository.PerformanceSnapshot{}, nil)

	// Test the service method
	result, err := service.CalculatePortfolioPerformance(ctx, portfolioID, &asOfDate)

	// Verify results
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, portfolioID, result.PortfolioID)
	assert.Equal(t, expectedMetrics.TotalValue, result.TotalValue)
	assert.Equal(t, expectedMetrics.TotalReturnPercentage, result.TotalReturnPercentage)
	assert.False(t, result.IsValid)
	assert.NotEmpty(t, result.ValidationErrors)
	assert.Equal(t, "TIME_WEIGHTED_RETURN", result.CalculationMethod.Method)

	// Verify mock was called
	mockPerformanceRepo.AssertExpectations(t)
}

func TestPerformanceService_TimeRangeValidation_Integration(t *testing.T) {
	// Create mock repositories
	mockPerformanceRepo := &MockPerformanceRepository{}
	mockPriceRepo := &MockPriceRepository{}
	mockPositionRepo := &MockPositionRepository{}

	// Create service
	service := NewPerformanceService(mockPerformanceRepo, mockPriceRepo, mockPositionRepo)

	t.Run("valid time range", func(t *testing.T) {
		timeRange := PerformanceTimeRange{
			Start: time.Now().AddDate(0, -1, 0),
			End:   time.Now(),
		}

		err := service.validateTimeRange(timeRange)
		assert.NoError(t, err)
	})

	t.Run("invalid time range - start after end", func(t *testing.T) {
		timeRange := PerformanceTimeRange{
			Start: time.Now(),
			End:   time.Now().AddDate(0, -1, 0),
		}

		err := service.validateTimeRange(timeRange)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "start date must be before end date")
	})

	t.Run("invalid time range - future end date", func(t *testing.T) {
		timeRange := PerformanceTimeRange{
			Start: time.Now(),
			End:   time.Now().AddDate(0, 1, 0),
		}

		err := service.validateTimeRange(timeRange)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "end date cannot be in the future")
	})
}

func TestPerformanceService_DiversificationScore_Integration(t *testing.T) {
	// Create mock repositories
	mockPerformanceRepo := &MockPerformanceRepository{}
	mockPriceRepo := &MockPriceRepository{}
	mockPositionRepo := &MockPositionRepository{}

	// Create service
	service := NewPerformanceService(mockPerformanceRepo, mockPriceRepo, mockPositionRepo)

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
