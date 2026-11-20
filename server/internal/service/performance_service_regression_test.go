package service

import (
	"context"
	"errors"
	"testing"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// A made-up downside deviation makes Sortino look computed when it is not.
// With too little history the metric must read as unavailable.
func TestCalculateDownsideDeviation_NoInventedValue(t *testing.T) {
	ctx := context.Background()
	const portfolioID = "portfolio-1"

	t.Run("fewer than two snapshots is zero", func(t *testing.T) {
		repo := new(MockPerformanceRepository)
		repo.On("GetPerformanceSnapshots", mock.Anything, portfolioID, mock.Anything, mock.Anything).
			Return([]repository.PerformanceSnapshot{{TotalValue: model.Money(10000)}}, nil)
		service := &PerformanceService{performanceRepo: repo}

		got := service.calculateDownsideDeviation(ctx, portfolioID, 30)
		require.True(t, got.IsZero(), "expected zero, got %s", got)
	})

	t.Run("negative returns produce their root mean square", func(t *testing.T) {
		repo := new(MockPerformanceRepository)
		repo.On("GetPerformanceSnapshots", mock.Anything, portfolioID, mock.Anything, mock.Anything).
			Return([]repository.PerformanceSnapshot{
				{TotalValue: model.Money(10000)},
				{TotalValue: model.Money(9000)},
			}, nil)
		service := &PerformanceService{performanceRepo: repo}

		got := service.calculateDownsideDeviation(ctx, portfolioID, 30)
		// One -10% return: sqrt(0.10^2) * 100 = 10.
		require.True(t, got.Sub(decimal.NewFromInt(10)).Abs().LessThan(decimal.NewFromFloat(0.0001)), "expected 10, got %s", got)
	})

	t.Run("repository error is zero", func(t *testing.T) {
		repo := new(MockPerformanceRepository)
		repo.On("GetPerformanceSnapshots", mock.Anything, portfolioID, mock.Anything, mock.Anything).
			Return([]repository.PerformanceSnapshot(nil), errors.New("boom"))
		service := &PerformanceService{performanceRepo: repo}

		require.True(t, service.calculateDownsideDeviation(ctx, portfolioID, 30).IsZero())
	})
}

// The z-score must follow the requested tail probability. The old code always
// used 1.645, so a 99% request silently returned the 95% number.
func TestCalculateValueAtRisk_HonoursTailProbability(t *testing.T) {
	ctx := context.Background()
	const portfolioID = "portfolio-1"

	repo := new(MockPerformanceRepository)
	repo.On("CalculateVolatility", mock.Anything, portfolioID, 30).
		Return(decimal.NewFromFloat(0.20), nil)
	service := &PerformanceService{performanceRepo: repo}

	var95 := service.calculateValueAtRisk(ctx, portfolioID, decimal.NewFromFloat(0.05), 30)
	var99 := service.calculateValueAtRisk(ctx, portfolioID, decimal.NewFromFloat(0.01), 30)

	require.True(t, var95.IsNegative(), "VaR must be a loss, got %s", var95)
	require.True(t, var99.LessThan(var95), "99%% VaR (%s) must be worse than 95%% (%s)", var99, var95)
	require.True(t, var95.Add(decimal.NewFromFloat(0.329)).Abs().LessThan(decimal.NewFromFloat(0.0001)), "expected -0.329, got %s", var95)
}

func TestCalculateValueAtRisk_VolatilityErrorIsZero(t *testing.T) {
	repo := new(MockPerformanceRepository)
	repo.On("CalculateVolatility", mock.Anything, "portfolio-1", 30).
		Return(decimal.Zero, errors.New("boom"))
	service := &PerformanceService{performanceRepo: repo}

	require.True(t, service.calculateValueAtRisk(context.Background(), "portfolio-1", decimal.NewFromFloat(0.05), 30).IsZero())
}
