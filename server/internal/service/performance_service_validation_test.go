package service

import (
	"sigma_finance/internal/repository"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
)

func TestPerformanceService_Validation(t *testing.T) {
	// Create service with nil repositories for validation testing
	service := &PerformanceService{}

	t.Run("validateTimeRange - valid range", func(t *testing.T) {
		timeRange := PerformanceTimeRange{
			Start: time.Now().AddDate(0, -1, 0),
			End:   time.Now(),
		}

		err := service.validateTimeRange(timeRange)
		assert.NoError(t, err)
	})

	t.Run("validateTimeRange - start after end", func(t *testing.T) {
		timeRange := PerformanceTimeRange{
			Start: time.Now(),
			End:   time.Now().AddDate(0, -1, 0),
		}

		err := service.validateTimeRange(timeRange)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "start date must be before end date")
	})

	t.Run("validateTimeRange - future end date", func(t *testing.T) {
		timeRange := PerformanceTimeRange{
			Start: time.Now(),
			End:   time.Now().AddDate(0, 1, 0),
		}

		err := service.validateTimeRange(timeRange)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "end date cannot be in the future")
	})

	t.Run("validateTimeRange - zero dates", func(t *testing.T) {
		timeRange := PerformanceTimeRange{
			Start: time.Time{},
			End:   time.Time{},
		}

		err := service.validateTimeRange(timeRange)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "start and end dates are required")
	})
}

func TestPerformanceService_DiversificationScore(t *testing.T) {
	service := &PerformanceService{}

	t.Run("well diversified portfolio", func(t *testing.T) {
		allocations := []repository.AssetAllocation{
			{Percentage: decimal.NewFromFloat(25.0)}, // 25%
			{Percentage: decimal.NewFromFloat(25.0)}, // 25%
			{Percentage: decimal.NewFromFloat(25.0)}, // 25%
			{Percentage: decimal.NewFromFloat(25.0)}, // 25%
		}

		score := service.calculateDiversificationScore(allocations)
		assert.True(t, score.GreaterThan(decimal.NewFromFloat(70)), "Well diversified portfolio should have high score")
	})

	t.Run("concentrated portfolio", func(t *testing.T) {
		allocations := []repository.AssetAllocation{
			{Percentage: decimal.NewFromFloat(90.0)}, // 90%
			{Percentage: decimal.NewFromFloat(10.0)}, // 10%
		}

		score := service.calculateDiversificationScore(allocations)
		assert.True(t, score.LessThan(decimal.NewFromFloat(50)), "Concentrated portfolio should have low score")
	})

	t.Run("single asset portfolio", func(t *testing.T) {
		allocations := []repository.AssetAllocation{
			{Percentage: decimal.NewFromFloat(100.0)}, // 100%
		}

		score := service.calculateDiversificationScore(allocations)
		assert.True(t, score.IsZero(), "Single asset portfolio should have zero diversification")
	})

	t.Run("empty allocations", func(t *testing.T) {
		allocations := []repository.AssetAllocation{}

		score := service.calculateDiversificationScore(allocations)
		assert.Equal(t, decimal.Zero, score, "Empty allocations should have zero diversification")
	})

	t.Run("three asset portfolio", func(t *testing.T) {
		allocations := []repository.AssetAllocation{
			{Percentage: decimal.NewFromFloat(50.0)}, // 50%
			{Percentage: decimal.NewFromFloat(30.0)}, // 30%
			{Percentage: decimal.NewFromFloat(20.0)}, // 20%
		}

		score := service.calculateDiversificationScore(allocations)
		assert.True(t, score.GreaterThan(decimal.NewFromFloat(40)), "Three asset portfolio should have moderate diversification")
		assert.True(t, score.LessThan(decimal.NewFromFloat(80)), "Three asset portfolio should not be perfectly diversified")
	})
}

func TestPerformanceService_CalculateCalmarRatio(t *testing.T) {
	service := &PerformanceService{}

	t.Run("positive return and drawdown", func(t *testing.T) {
		annualizedReturn := decimal.NewFromFloat(15.0) // 15% return
		maxDrawdown := decimal.NewFromFloat(5.0)       // 5% drawdown

		calmarRatio := service.calculateCalmarRatio(annualizedReturn, maxDrawdown)
		expected := decimal.NewFromFloat(3.0) // 15/5 = 3

		assert.True(t, calmarRatio.Equal(expected), "Calmar ratio should be 3.0")
	})

	t.Run("zero drawdown", func(t *testing.T) {
		annualizedReturn := decimal.NewFromFloat(15.0)
		maxDrawdown := decimal.Zero

		calmarRatio := service.calculateCalmarRatio(annualizedReturn, maxDrawdown)

		assert.Equal(t, decimal.Zero, calmarRatio, "Calmar ratio should be zero when drawdown is zero")
	})

	t.Run("negative return", func(t *testing.T) {
		annualizedReturn := decimal.NewFromFloat(-5.0) // -5% return
		maxDrawdown := decimal.NewFromFloat(10.0)      // 10% drawdown

		calmarRatio := service.calculateCalmarRatio(annualizedReturn, maxDrawdown)
		expected := decimal.NewFromFloat(-0.5) // -5/10 = -0.5

		assert.True(t, calmarRatio.Equal(expected), "Calmar ratio should be -0.5")
	})
}

func TestPerformanceService_RiskAdjustedAlpha(t *testing.T) {
	service := &PerformanceService{}

	t.Run("positive alpha and beta", func(t *testing.T) {
		alpha := decimal.NewFromFloat(2.0) // 2% alpha
		beta := decimal.NewFromFloat(1.2)  // 1.2 beta

		riskAdjustedAlpha := service.calculateRiskAdjustedAlpha(alpha, beta)
		expected := alpha.Div(beta) // 2 / 1.2 ≈ 1.667

		assert.True(t, riskAdjustedAlpha.Sub(expected).Abs().LessThan(decimal.NewFromFloat(0.001)), "Risk adjusted alpha should be approximately 1.667")
	})

	t.Run("zero alpha", func(t *testing.T) {
		alpha := decimal.Zero
		beta := decimal.NewFromFloat(1.0)

		riskAdjustedAlpha := service.calculateRiskAdjustedAlpha(alpha, beta)

		assert.True(t, riskAdjustedAlpha.IsZero(), "Risk adjusted alpha should be zero when alpha is zero")
	})

	t.Run("negative alpha", func(t *testing.T) {
		alpha := decimal.NewFromFloat(-1.0) // -1% alpha
		beta := decimal.NewFromFloat(0.8)   // 0.8 beta

		riskAdjustedAlpha := service.calculateRiskAdjustedAlpha(alpha, beta)
		expected := alpha.Div(beta) // -1 / 0.8 = -1.25

		assert.True(t, riskAdjustedAlpha.Sub(expected).Abs().LessThan(decimal.NewFromFloat(0.001)), "Risk adjusted alpha should be approximately -1.25")
	})
}

func TestPerformanceService_TypeDefinitions(t *testing.T) {
	t.Run("PerformanceTimeRange creation", func(t *testing.T) {
		start := time.Now().AddDate(0, -1, 0)
		end := time.Now()

		timeRange := PerformanceTimeRange{
			Start: start,
			End:   end,
		}

		assert.Equal(t, start, timeRange.Start)
		assert.Equal(t, end, timeRange.End)
	})

	t.Run("ReportType constants", func(t *testing.T) {
		assert.Equal(t, ReportType("DAILY"), ReportTypeDaily)
		assert.Equal(t, ReportType("WEEKLY"), ReportTypeWeekly)
		assert.Equal(t, ReportType("MONTHLY"), ReportTypeMonthly)
		assert.Equal(t, ReportType("QUARTERLY"), ReportTypeQuarterly)
		assert.Equal(t, ReportType("ANNUAL"), ReportTypeAnnual)
		assert.Equal(t, ReportType("CUSTOM"), ReportTypeCustom)
	})

	t.Run("DataQuality structure", func(t *testing.T) {
		dataQuality := DataQuality{
			Score:               decimal.NewFromFloat(95.5),
			MissingDataPoints:   2,
			StaleDataPoints:     1,
			EstimatedDataPoints: 0,
			LastUpdated:         time.Now(),
		}

		assert.Equal(t, decimal.NewFromFloat(95.5), dataQuality.Score)
		assert.Equal(t, 2, dataQuality.MissingDataPoints)
		assert.Equal(t, 1, dataQuality.StaleDataPoints)
		assert.Equal(t, 0, dataQuality.EstimatedDataPoints)
	})
}

func TestPerformanceService_ServiceCreation(t *testing.T) {
	t.Run("NewPerformanceService creates service correctly", func(t *testing.T) {
		// This test verifies the constructor works without actual repository implementations
		// We'll pass nil values since we're just testing the constructor
		service := NewPerformanceService(nil, nil, nil)

		assert.NotNil(t, service)
		// The repositories will be nil, but the service structure should be created
	})
}
