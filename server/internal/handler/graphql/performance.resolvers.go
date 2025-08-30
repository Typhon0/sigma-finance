package graphql

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"

	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/service"
)

// Performance calculation resolvers

// PortfolioPerformance is the resolver for the portfolioPerformance field.
func (r *queryResolver) PortfolioPerformance(ctx context.Context, portfolioID string, asOfDate *time.Time) (*gqlModel.PerformanceMetrics, error) {
	// Parse portfolio ID
	portfolioUUID, err := uuid.Parse(portfolioID)
	if err != nil {
		return nil, fmt.Errorf("invalid portfolio ID: %w", err)
	}

	// Get performance metrics from service
	metrics, err := r.PerformanceService.CalculatePortfolioPerformance(ctx, portfolioUUID, asOfDate)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate portfolio performance: %w", err)
	}

	// Convert to GraphQL model
	return mapPerformanceMetricsToGQL(metrics), nil
}

// PortfolioAllocation is the resolver for the portfolioAllocation field.
func (r *queryResolver) PortfolioAllocation(ctx context.Context, portfolioID string, asOfDate *time.Time) (*gqlModel.AllocationBreakdown, error) {
	// Parse portfolio ID
	portfolioUUID, err := uuid.Parse(portfolioID)
	if err != nil {
		return nil, fmt.Errorf("invalid portfolio ID: %w", err)
	}

	// Get allocation breakdown from service
	allocation, err := r.PerformanceService.CalculateAssetAllocation(ctx, portfolioUUID, asOfDate)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate asset allocation: %w", err)
	}

	// Convert to GraphQL model
	return mapAllocationBreakdownToGQL(allocation), nil
}

// PortfolioRiskMetrics is the resolver for the portfolioRiskMetrics field.
func (r *queryResolver) PortfolioRiskMetrics(ctx context.Context, portfolioID string, timeRange gqlModel.PerformanceTimeRangeInput) (*gqlModel.RiskMetrics, error) {
	// Parse portfolio ID
	portfolioUUID, err := uuid.Parse(portfolioID)
	if err != nil {
		return nil, fmt.Errorf("invalid portfolio ID: %w", err)
	}

	// Convert time range
	serviceTimeRange := service.PerformanceTimeRange{
		Start: timeRange.Start,
		End:   timeRange.End,
	}

	// Get risk metrics from service
	riskMetrics, err := r.PerformanceService.CalculateRiskMetrics(ctx, portfolioUUID, serviceTimeRange)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate risk metrics: %w", err)
	}

	// Convert to GraphQL model
	return mapRiskMetricsToGQL(riskMetrics), nil
}

// Performance snapshots resolvers

// PerformanceSnapshots is the resolver for the performanceSnapshots field.
func (r *queryResolver) PerformanceSnapshots(ctx context.Context, portfolioID string, timeRange gqlModel.PerformanceTimeRangeInput) ([]*gqlModel.PerformanceSnapshot, error) {
	// Parse portfolio ID
	portfolioUUID, err := uuid.Parse(portfolioID)
	if err != nil {
		return nil, fmt.Errorf("invalid portfolio ID: %w", err)
	}

	// Convert time range
	serviceTimeRange := service.PerformanceTimeRange{
		Start: timeRange.Start,
		End:   timeRange.End,
	}

	// Get snapshots from service
	snapshots, err := r.PerformanceService.GetPerformanceSnapshots(ctx, portfolioUUID, serviceTimeRange)
	if err != nil {
		return nil, fmt.Errorf("failed to get performance snapshots: %w", err)
	}

	// Convert to GraphQL model
	result := make([]*gqlModel.PerformanceSnapshot, len(snapshots))
	for i, snapshot := range snapshots {
		result[i] = mapPerformanceSnapshotToGQL(&snapshot)
	}

	return result, nil
}

// LatestPerformanceSnapshot is the resolver for the latestPerformanceSnapshot field.
func (r *queryResolver) LatestPerformanceSnapshot(ctx context.Context, portfolioID string) (*gqlModel.PerformanceSnapshot, error) {
	// Parse portfolio ID
	portfolioUUID, err := uuid.Parse(portfolioID)
	if err != nil {
		return nil, fmt.Errorf("invalid portfolio ID: %w", err)
	}

	// Get latest snapshot from service
	snapshot, err := r.PerformanceService.GetLatestPerformanceSnapshot(ctx, portfolioUUID)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest performance snapshot: %w", err)
	}

	if snapshot == nil {
		return nil, nil
	}

	// Convert to GraphQL model
	return mapPerformanceSnapshotToGQL(snapshot), nil
}

// Chart data resolvers

// PortfolioChartData is the resolver for the portfolioChartData field.
func (r *queryResolver) PortfolioChartData(ctx context.Context, input gqlModel.ChartDataInput) (*gqlModel.TimeSeriesData, error) {
	if input.PortfolioID == nil {
		return nil, fmt.Errorf("portfolio ID is required for portfolio chart data")
	}

	// Parse portfolio ID
	portfolioUUID, err := uuid.Parse(*input.PortfolioID)
	if err != nil {
		return nil, fmt.Errorf("invalid portfolio ID: %w", err)
	}

	// Convert time range
	serviceTimeRange := service.PerformanceTimeRange{
		Start: input.TimeRange.Start,
		End:   input.TimeRange.End,
	}

	// Get performance snapshots for chart data
	snapshots, err := r.PerformanceService.GetPerformanceSnapshots(ctx, portfolioUUID, serviceTimeRange)
	if err != nil {
		return nil, fmt.Errorf("failed to get chart data: %w", err)
	}

	// Convert to chart data points
	dataPoints := make([]*gqlModel.ChartDataPoint, len(snapshots))
	for i, snapshot := range snapshots {
		dataPoints[i] = &gqlModel.ChartDataPoint{
			Timestamp: snapshot.SnapshotDate,
			Value:     float64(snapshot.TotalValue),
			Volume:    nil, // Portfolio doesn't have volume
			Metadata:  nil,
		}
	}

	return &gqlModel.TimeSeriesData{
		PortfolioID: input.PortfolioID,
		AssetID:     nil,
		DataPoints:  dataPoints,
		TimeRange: &gqlModel.TimeRange{
			Start: input.TimeRange.Start,
			End:   input.TimeRange.End,
		},
		Aggregation: input.Aggregation,
	}, nil
}

// AssetChartData is the resolver for the assetChartData field.
func (r *queryResolver) AssetChartData(ctx context.Context, input gqlModel.ChartDataInput) (*gqlModel.TimeSeriesData, error) {
	if input.AssetID == nil {
		return nil, fmt.Errorf("asset ID is required for asset chart data")
	}

	// Parse asset ID
	assetUUID, err := uuid.Parse(*input.AssetID)
	if err != nil {
		return nil, fmt.Errorf("invalid asset ID: %w", err)
	}

	// Get price history from market data service
	// Note: This would typically come from a price repository or market data service
	// For now, we'll return a placeholder implementation
	dataPoints := []*gqlModel.ChartDataPoint{
		{
			Timestamp: input.TimeRange.Start,
			Value:     100.0,
			Volume:    &[]float64{1000.0}[0],
		},
		{
			Timestamp: input.TimeRange.End,
			Value:     110.0,
			Volume:    &[]float64{1200.0}[0],
		},
	}

	return &gqlModel.TimeSeriesData{
		PortfolioID: nil,
		AssetID:     input.AssetID,
		DataPoints:  dataPoints,
		TimeRange: &gqlModel.TimeRange{
			Start: input.TimeRange.Start,
			End:   input.TimeRange.End,
		},
		Aggregation: input.Aggregation,
	}, nil
}

// AllocationChartData is the resolver for the allocationChartData field.
func (r *queryResolver) AllocationChartData(ctx context.Context, portfolioID string, timeRange *gqlModel.PerformanceTimeRangeInput) ([]*gqlModel.ChartDataPoint, error) {
	// Parse portfolio ID
	portfolioUUID, err := uuid.Parse(portfolioID)
	if err != nil {
		return nil, fmt.Errorf("invalid portfolio ID: %w", err)
	}

	// Get current allocation
	var asOfDate *time.Time
	if timeRange != nil {
		asOfDate = &timeRange.End
	}

	allocation, err := r.PerformanceService.CalculateAssetAllocation(ctx, portfolioUUID, asOfDate)
	if err != nil {
		return nil, fmt.Errorf("failed to get allocation data: %w", err)
	}

	// Convert allocations to chart data points
	dataPoints := make([]*gqlModel.ChartDataPoint, len(allocation.AllocationBreakdown.Allocations))
	for i, alloc := range allocation.AllocationBreakdown.Allocations {
		dataPoints[i] = &gqlModel.ChartDataPoint{
			Timestamp: time.Now(),
			Value:     float64(alloc.Value),
			Volume:    nil,
			Metadata: &gqlModel.ChartMetadata{
				Label: &alloc.AssetType.String(),
				Color: nil,
				AdditionalData: []*gqlModel.KeyValuePair{
					{
						Key:   "percentage",
						Value: alloc.Percentage.String(),
					},
					{
						Key:   "count",
						Value: strconv.Itoa(int(alloc.Count)),
					},
				},
			},
		}
	}

	return dataPoints, nil
}

// Comparative analysis resolvers

// ComparePortfolios is the resolver for the comparePortfolios field.
func (r *queryResolver) ComparePortfolios(ctx context.Context, portfolioIds []string, timeRange gqlModel.PerformanceTimeRangeInput) ([]*gqlModel.PerformanceMetrics, error) {
	// Parse portfolio IDs
	portfolioUUIDs := make([]uuid.UUID, len(portfolioIds))
	for i, id := range portfolioIds {
		portfolioUUID, err := uuid.Parse(id)
		if err != nil {
			return nil, fmt.Errorf("invalid portfolio ID %s: %w", id, err)
		}
		portfolioUUIDs[i] = portfolioUUID
	}

	// Convert time range
	serviceTimeRange := service.PerformanceTimeRange{
		Start: timeRange.Start,
		End:   timeRange.End,
	}

	// Get comparative performance from service
	comparison, err := r.PerformanceService.ComparePortfolioPerformance(ctx, portfolioUUIDs, serviceTimeRange)
	if err != nil {
		return nil, fmt.Errorf("failed to compare portfolios: %w", err)
	}

	// Convert to GraphQL model
	result := make([]*gqlModel.PerformanceMetrics, 0, len(comparison))
	for _, metrics := range comparison {
		result = append(result, mapPerformanceMetricsToGQL(metrics))
	}

	return result, nil
}

// BenchmarkComparison is the resolver for the benchmarkComparison field.
func (r *queryResolver) BenchmarkComparison(ctx context.Context, portfolioID string, benchmarkAssetID string, timeRange gqlModel.PerformanceTimeRangeInput) (*gqlModel.BenchmarkComparison, error) {
	// Parse IDs
	portfolioUUID, err := uuid.Parse(portfolioID)
	if err != nil {
		return nil, fmt.Errorf("invalid portfolio ID: %w", err)
	}

	benchmarkUUID, err := uuid.Parse(benchmarkAssetID)
	if err != nil {
		return nil, fmt.Errorf("invalid benchmark asset ID: %w", err)
	}

	// Convert time range
	serviceTimeRange := service.PerformanceTimeRange{
		Start: timeRange.Start,
		End:   timeRange.End,
	}

	// Get benchmark comparison from service
	comparison, err := r.PerformanceService.CalculateBenchmarkComparison(ctx, portfolioUUID, benchmarkUUID, serviceTimeRange)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate benchmark comparison: %w", err)
	}

	// Convert to GraphQL model
	return mapBenchmarkComparisonToGQL(comparison), nil
}

// TopPerformingAssets is the resolver for the topPerformingAssets field.
func (r *queryResolver) TopPerformingAssets(ctx context.Context, portfolioID string, limit *int, timeRange gqlModel.PerformanceTimeRangeInput) ([]*gqlModel.PositionPerformance, error) {
	// Parse portfolio ID
	portfolioUUID, err := uuid.Parse(portfolioID)
	if err != nil {
		return nil, fmt.Errorf("invalid portfolio ID: %w", err)
	}

	// Set default limit
	limitValue := 10
	if limit != nil {
		limitValue = *limit
	}

	// Convert time range
	serviceTimeRange := service.PerformanceTimeRange{
		Start: timeRange.Start,
		End:   timeRange.End,
	}

	// Get top performing assets from service
	positions, err := r.PerformanceService.GetTopPerformingAssets(ctx, portfolioUUID, limitValue, serviceTimeRange)
	if err != nil {
		return nil, fmt.Errorf("failed to get top performing assets: %w", err)
	}

	// Convert to GraphQL model
	result := make([]*gqlModel.PositionPerformance, len(positions))
	for i, position := range positions {
		result[i] = mapPositionToPositionPerformance(&position)
	}

	return result, nil
}

// WorstPerformingAssets is the resolver for the worstPerformingAssets field.
func (r *queryResolver) WorstPerformingAssets(ctx context.Context, portfolioID string, limit *int, timeRange gqlModel.PerformanceTimeRangeInput) ([]*gqlModel.PositionPerformance, error) {
	// Parse portfolio ID
	portfolioUUID, err := uuid.Parse(portfolioID)
	if err != nil {
		return nil, fmt.Errorf("invalid portfolio ID: %w", err)
	}

	// Set default limit
	limitValue := 10
	if limit != nil {
		limitValue = *limit
	}

	// Convert time range
	serviceTimeRange := service.PerformanceTimeRange{
		Start: timeRange.Start,
		End:   timeRange.End,
	}

	// Get worst performing assets from service
	positions, err := r.PerformanceService.GetWorstPerformingAssets(ctx, portfolioUUID, limitValue, serviceTimeRange)
	if err != nil {
		return nil, fmt.Errorf("failed to get worst performing assets: %w", err)
	}

	// Convert to GraphQL model
	result := make([]*gqlModel.PositionPerformance, len(positions))
	for i, position := range positions {
		result[i] = mapPositionToPositionPerformance(&position)
	}

	return result, nil
}

// Reports resolver

// GeneratePerformanceReport is the resolver for the generatePerformanceReport field.
func (r *queryResolver) GeneratePerformanceReport(ctx context.Context, input gqlModel.GenerateReportInput) (*gqlModel.PerformanceReport, error) {
	// Parse portfolio ID
	portfolioUUID, err := uuid.Parse(input.PortfolioID)
	if err != nil {
		return nil, fmt.Errorf("invalid portfolio ID: %w", err)
	}

	// Convert time range
	serviceTimeRange := service.PerformanceTimeRange{
		Start: input.TimeRange.Start,
		End:   input.TimeRange.End,
	}

	// Convert report type
	var reportType service.ReportType
	switch input.ReportType {
	case gqlModel.ReportTypeDaily:
		reportType = service.ReportTypeDaily
	case gqlModel.ReportTypeWeekly:
		reportType = service.ReportTypeWeekly
	case gqlModel.ReportTypeMonthly:
		reportType = service.ReportTypeMonthly
	case gqlModel.ReportTypeQuarterly:
		reportType = service.ReportTypeQuarterly
	case gqlModel.ReportTypeAnnual:
		reportType = service.ReportTypeAnnual
	case gqlModel.ReportTypeCustom:
		reportType = service.ReportTypeCustom
	default:
		return nil, fmt.Errorf("invalid report type: %s", input.ReportType)
	}

	// Generate report from service
	report, err := r.PerformanceService.GeneratePerformanceReport(ctx, portfolioUUID, reportType, serviceTimeRange)
	if err != nil {
		return nil, fmt.Errorf("failed to generate performance report: %w", err)
	}

	// Convert to GraphQL model
	return mapPerformanceReportToGQL(report), nil
}

// Performance snapshot mutations

// CreatePerformanceSnapshot is the resolver for the createPerformanceSnapshot field.
func (r *mutationResolver) CreatePerformanceSnapshot(ctx context.Context, portfolioID string, asOfDate time.Time) (*gqlModel.PerformanceSnapshot, error) {
	// Parse portfolio ID
	portfolioUUID, err := uuid.Parse(portfolioID)
	if err != nil {
		return nil, fmt.Errorf("invalid portfolio ID: %w", err)
	}

	// Create snapshot using service
	snapshot, err := r.PerformanceService.CreatePerformanceSnapshot(ctx, portfolioUUID, asOfDate)
	if err != nil {
		return nil, fmt.Errorf("failed to create performance snapshot: %w", err)
	}

	// Convert to GraphQL model
	return mapPerformanceSnapshotToGQL(snapshot), nil
}

// UpdatePerformanceSnapshots is the resolver for the updatePerformanceSnapshots field.
func (r *mutationResolver) UpdatePerformanceSnapshots(ctx context.Context, portfolioIds []string, asOfDate time.Time) (bool, error) {
	// Parse portfolio IDs
	portfolioUUIDs := make([]uuid.UUID, len(portfolioIds))
	for i, id := range portfolioIds {
		portfolioUUID, err := uuid.Parse(id)
		if err != nil {
			return false, fmt.Errorf("invalid portfolio ID %s: %w", id, err)
		}
		portfolioUUIDs[i] = portfolioUUID
	}

	// Update snapshots using service
	err := r.PerformanceService.UpdatePerformanceSnapshots(ctx, portfolioUUIDs, asOfDate)
	if err != nil {
		return false, fmt.Errorf("failed to update performance snapshots: %w", err)
	}

	return true, nil
}
