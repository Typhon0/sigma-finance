package graphql

import (
	"context"
	"fmt"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
)

// =========================================================================
// stubPerformanceService – implements service.IPerformanceService for tests.
// Only CalculateBenchmarkComparison is functional; all others panic.
// =========================================================================

type stubPerformanceService struct {
	comparison *service.BenchmarkComparison
	err        error
}

func (s *stubPerformanceService) CalculateBenchmarkComparison(
	_ context.Context, _, _ string, _ service.PerformanceTimeRange, _ ...model.Currency,
) (*service.BenchmarkComparison, error) {
	return s.comparison, s.err
}

func (s *stubPerformanceService) CalculatePortfolioPerformance(
	_ context.Context, _ string, _ *time.Time, _ ...model.Currency,
) (*service.ServicePerformanceMetrics, error) {
	panic("not implemented")
}
func (s *stubPerformanceService) CalculateTimeWeightedReturn(
	_ context.Context, _ string, _ service.PerformanceTimeRange,
) (decimal.Decimal, error) {
	panic("not implemented")
}
func (s *stubPerformanceService) CalculateVolatility(
	_ context.Context, _ string, _ int,
) (decimal.Decimal, error) {
	panic("not implemented")
}
func (s *stubPerformanceService) CalculateSharpeRatio(
	_ context.Context, _ string, _ decimal.Decimal, _ int,
) (decimal.Decimal, error) {
	panic("not implemented")
}
func (s *stubPerformanceService) CalculateMaxDrawdown(
	_ context.Context, _ string, _ service.PerformanceTimeRange,
) (decimal.Decimal, error) {
	panic("not implemented")
}
func (s *stubPerformanceService) CalculateAssetAllocation(
	_ context.Context, _ string, _ *time.Time,
) (*service.AllocationBreakdown, error) {
	panic("not implemented")
}
func (s *stubPerformanceService) CalculateAllocationByType(
	_ context.Context, _ string,
) ([]service.ServiceAssetAllocation, error) {
	panic("not implemented")
}
func (s *stubPerformanceService) CalculateAllocationBySector(
	_ context.Context, _ string,
) ([]service.ServiceAssetAllocation, error) {
	panic("not implemented")
}
func (s *stubPerformanceService) CalculateAllocationByGeography(
	_ context.Context, _ string,
) ([]service.ServiceAssetAllocation, error) {
	panic("not implemented")
}
func (s *stubPerformanceService) CreatePerformanceSnapshot(
	_ context.Context, _ string, _ time.Time,
) (*service.PerformanceSnapshot, error) {
	panic("not implemented")
}
func (s *stubPerformanceService) GetPerformanceSnapshots(
	_ context.Context, _ string, _ service.PerformanceTimeRange,
) ([]service.PerformanceSnapshot, error) {
	panic("not implemented")
}
func (s *stubPerformanceService) GetLatestPerformanceSnapshot(
	_ context.Context, _ string,
) (*service.PerformanceSnapshot, error) {
	panic("not implemented")
}
func (s *stubPerformanceService) UpdatePerformanceSnapshots(
	_ context.Context, _ []string, _ time.Time,
) error {
	panic("not implemented")
}
func (s *stubPerformanceService) ComparePortfolioPerformance(
	_ context.Context, _ []string, _ service.PerformanceTimeRange,
) (map[string]*service.ServicePerformanceMetrics, error) {
	panic("not implemented")
}
func (s *stubPerformanceService) GetTopPerformingAssets(
	_ context.Context, _ string, _ int, _ service.PerformanceTimeRange,
) ([]repository.PositionPerformanceResult, error) {
	panic("not implemented")
}
func (s *stubPerformanceService) GetWorstPerformingAssets(
	_ context.Context, _ string, _ int, _ service.PerformanceTimeRange,
) ([]repository.PositionPerformanceResult, error) {
	panic("not implemented")
}
func (s *stubPerformanceService) CalculateRiskMetrics(
	_ context.Context, _ string, _ service.PerformanceTimeRange,
) (*service.ServiceRiskMetrics, error) {
	panic("not implemented")
}
func (s *stubPerformanceService) GeneratePerformanceReport(
	_ context.Context, _ string, _ service.ReportType, _ service.PerformanceTimeRange,
) (*service.PerformanceReport, error) {
	panic("not implemented")
}

// ---------------------------------------------------------------------------
// Helper: build a service.BenchmarkComparison with embedded repo data.
// ---------------------------------------------------------------------------

// newBenchmarkComparison builds a service.BenchmarkComparison with the
// embedded *repository.BenchmarkComparison populated from the given values.
func newBenchmarkComparison(
	portfolioID, benchmarkAssetID string,
	portfolioReturn, benchmarkReturn, alpha, beta,
	correlation, trackingError, infoRatio, riskAdjAlpha float64,
	periods []service.PerformanceTimeRange,
) *service.BenchmarkComparison {
	return &service.BenchmarkComparison{
		BenchmarkComparison: &repository.BenchmarkComparison{
			PortfolioID:      portfolioID,
			BenchmarkAssetID: benchmarkAssetID,
			PortfolioReturn:  decimal.NewFromFloat(portfolioReturn),
			BenchmarkReturn:  decimal.NewFromFloat(benchmarkReturn),
			Alpha:            decimal.NewFromFloat(alpha),
			Beta:             decimal.NewFromFloat(beta),
			CorrelationCoeff: decimal.NewFromFloat(correlation),
			TrackingError:    decimal.NewFromFloat(trackingError),
			InformationRatio: decimal.NewFromFloat(infoRatio),
		},
		OutperformancePeriods: periods,
		RiskAdjustedAlpha:     decimal.NewFromFloat(riskAdjAlpha),
	}
}

// =========================================================================
// Mapper tests
// =========================================================================

func TestMapBenchmarkComparisonToGQL_NilInput(t *testing.T) {
	result := mapBenchmarkComparisonToGQL(nil)
	assert.Nil(t, result, "nil input should return nil")
}

func TestMapBenchmarkComparisonToGQL_FullData(t *testing.T) {
	now := time.Now().UTC()
	periodStart := now.Add(-90 * 24 * time.Hour)
	periodEnd := now.Add(-60 * 24 * time.Hour)

	comparison := newBenchmarkComparison(
		"portfolio-abc", "benchmark-xyz",
		0.152, 0.121, 0.031, 1.08,
		0.94, 0.045, 0.69, 0.028,
		[]service.PerformanceTimeRange{
			{Start: periodStart, End: periodEnd},
		},
	)

	result := mapBenchmarkComparisonToGQL(comparison)

	assert.NotNil(t, result, "valid comparison should produce a non-nil result")
	assert.Equal(t, "portfolio-abc", result.PortfolioID)
	assert.Equal(t, "benchmark-xyz", result.BenchmarkAssetID)
	assert.InDelta(t, 0.152, result.PortfolioReturn, 0.0001)
	assert.InDelta(t, 0.121, result.BenchmarkReturn, 0.0001)
	assert.InDelta(t, 0.031, result.Alpha, 0.0001)
	assert.InDelta(t, 1.08, result.Beta, 0.0001)
	assert.InDelta(t, 0.94, result.Correlation, 0.0001)
	assert.InDelta(t, 0.045, result.TrackingError, 0.0001)
	assert.InDelta(t, 0.69, result.InformationRatio, 0.0001)
	assert.InDelta(t, 0.028, result.RiskAdjustedAlpha, 0.0001)

	assert.Len(t, result.OutperformancePeriods, 1)
	assert.True(t, periodStart.Equal(result.OutperformancePeriods[0].Start))
	assert.True(t, periodEnd.Equal(result.OutperformancePeriods[0].End))
}

func TestMapBenchmarkComparisonToGQL_EmptyOutperformancePeriods(t *testing.T) {
	comparison := newBenchmarkComparison(
		"p-1", "b-1",
		0.10, 0.08, 0, 0,
		0, 0, 0, 0,
		nil,
	)

	result := mapBenchmarkComparisonToGQL(comparison)

	assert.NotNil(t, result)
	assert.Empty(t, result.OutperformancePeriods,
		"nil outperformance periods should map to empty slice")
	assert.InDelta(t, 0.10, result.PortfolioReturn, 0.0001)
	assert.InDelta(t, 0.08, result.BenchmarkReturn, 0.0001)
}

func TestMapBenchmarkComparisonToGQL_NegativeReturns(t *testing.T) {
	comparison := newBenchmarkComparison(
		"p-neg", "b-neg",
		-0.073, -0.051, -0.022, 0.95,
		0.88, 0.052, -0.42, -0.019,
		[]service.PerformanceTimeRange{},
	)

	result := mapBenchmarkComparisonToGQL(comparison)

	assert.NotNil(t, result)
	assert.InDelta(t, -0.073, result.PortfolioReturn, 0.0001)
	assert.InDelta(t, -0.051, result.BenchmarkReturn, 0.0001)
	assert.InDelta(t, -0.022, result.Alpha, 0.0001)
	assert.InDelta(t, 0.95, result.Beta, 0.0001)
	assert.InDelta(t, -0.42, result.InformationRatio, 0.0001)
}

func TestMapBenchmarkComparisonToGQL_MultipleOutperformancePeriods(t *testing.T) {
	now := time.Now().UTC()
	p1 := now.Add(-180 * 24 * time.Hour)
	p2 := now.Add(-120 * 24 * time.Hour)
	p3 := now.Add(-60 * 24 * time.Hour)

	comparison := newBenchmarkComparison(
		"p-multi", "b-multi",
		0, 0, 0, 0, 0, 0, 0, 0,
		[]service.PerformanceTimeRange{
			{Start: p1, End: p2},
			{Start: p2, End: p3},
		},
	)

	result := mapBenchmarkComparisonToGQL(comparison)

	assert.NotNil(t, result)
	assert.Len(t, result.OutperformancePeriods, 2)
	assert.True(t, p1.Equal(result.OutperformancePeriods[0].Start))
	assert.True(t, p2.Equal(result.OutperformancePeriods[0].End))
	assert.True(t, p2.Equal(result.OutperformancePeriods[1].Start))
	assert.True(t, p3.Equal(result.OutperformancePeriods[1].End))
}

// =========================================================================
// Resolver tests
// =========================================================================

func TestBenchmarkComparisonResolver_Success(t *testing.T) {
	comparison := newBenchmarkComparison(
		"portfolio-1", "benchmark-spy",
		0.124, 0.098, 0.026, 1.12,
		0.91, 0.038, 0.68, 0.024,
		nil,
	)

	ps := &stubPerformanceService{comparison: comparison, err: nil}
	r := buildTestResolver(ps)

	now := time.Now().UTC()
	start := now.Add(-90 * 24 * time.Hour)
	gqlTimeRange := gqlModel.PerformanceTimeRangeInput{Start: start, End: now}

	result, err := r.Query().BenchmarkComparison(
		context.Background(),
		"portfolio-1",
		"benchmark-spy",
		gqlTimeRange,
	)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, "portfolio-1", result.PortfolioID)
	assert.Equal(t, "benchmark-spy", result.BenchmarkAssetID)
	assert.InDelta(t, 0.124, result.PortfolioReturn, 0.0001)
	assert.InDelta(t, 0.098, result.BenchmarkReturn, 0.0001)
	assert.InDelta(t, 0.026, result.Alpha, 0.0001)
	assert.InDelta(t, 1.12, result.Beta, 0.0001)
}

func TestBenchmarkComparisonResolver_ServiceError(t *testing.T) {
	ps := &stubPerformanceService{
		comparison: nil,
		err:        fmt.Errorf("no snapshots available for the requested time range"),
	}
	r := buildTestResolver(ps)

	now := time.Now().UTC()
	gqlTimeRange := gqlModel.PerformanceTimeRangeInput{
		Start: now.Add(-365 * 24 * time.Hour),
		End:   now,
	}

	result, err := r.Query().BenchmarkComparison(
		context.Background(),
		"portfolio-1",
		"benchmark-spy",
		gqlTimeRange,
	)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "benchmark comparison")
	assert.Contains(t, err.Error(), "no snapshots available")
}

func TestBenchmarkComparisonResolver_NilComparison(t *testing.T) {
	ps := &stubPerformanceService{comparison: nil, err: nil}
	r := buildTestResolver(ps)

	now := time.Now().UTC()
	gqlTimeRange := gqlModel.PerformanceTimeRangeInput{
		Start: now.Add(-30 * 24 * time.Hour),
		End:   now,
	}

	result, err := r.Query().BenchmarkComparison(
		context.Background(),
		"portfolio-empty",
		"benchmark-spy",
		gqlTimeRange,
	)

	assert.NoError(t, err)
	assert.Nil(t, result, "nil service result should produce nil GQL result")
}

// =========================================================================
// Helper: build a Resolver with only the performance service wired
// =========================================================================

func buildTestResolver(ps service.IPerformanceService) *Resolver {
	return &Resolver{
		PerformanceService: ps,
	}
}
