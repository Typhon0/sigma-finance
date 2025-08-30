package service

import (
	"context"
	"errors"
	"fmt"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// PerformanceService provides business logic for performance calculation operations
type PerformanceService struct {
	performanceRepo repository.IPerformanceRepository
	priceRepo       repository.IPriceRepository
	positionRepo    repository.IPositionRepository
}

// NewPerformanceService creates a new PerformanceService instance
func NewPerformanceService(
	performanceRepo repository.IPerformanceRepository,
	priceRepo repository.IPriceRepository,
	positionRepo repository.IPositionRepository,
) *PerformanceService {
	return &PerformanceService{
		performanceRepo: performanceRepo,
		priceRepo:       priceRepo,
		positionRepo:    positionRepo,
	}
}

// IPerformanceService defines the interface for performance calculation operations
type IPerformanceService interface {
	// Performance calculations
	CalculatePortfolioPerformance(ctx context.Context, portfolioID uuid.UUID, asOfDate *time.Time) (*PerformanceMetrics, error)
	CalculateTimeWeightedReturn(ctx context.Context, portfolioID uuid.UUID, timeRange PerformanceTimeRange) (decimal.Decimal, error)
	CalculateVolatility(ctx context.Context, portfolioID uuid.UUID, days int) (decimal.Decimal, error)
	CalculateSharpeRatio(ctx context.Context, portfolioID uuid.UUID, riskFreeRate decimal.Decimal, days int) (decimal.Decimal, error)
	CalculateMaxDrawdown(ctx context.Context, portfolioID uuid.UUID, timeRange PerformanceTimeRange) (decimal.Decimal, error)

	// Asset allocation calculations
	CalculateAssetAllocation(ctx context.Context, portfolioID uuid.UUID, asOfDate *time.Time) (*AllocationBreakdown, error)
	CalculateAllocationByType(ctx context.Context, portfolioID uuid.UUID) ([]AssetAllocation, error)
	CalculateAllocationBySector(ctx context.Context, portfolioID uuid.UUID) ([]AssetAllocation, error)
	CalculateAllocationByGeography(ctx context.Context, portfolioID uuid.UUID) ([]AssetAllocation, error)

	// Performance snapshots
	CreatePerformanceSnapshot(ctx context.Context, portfolioID uuid.UUID, asOfDate time.Time) (*PerformanceSnapshot, error)
	GetPerformanceSnapshots(ctx context.Context, portfolioID uuid.UUID, timeRange PerformanceTimeRange) ([]PerformanceSnapshot, error)
	GetLatestPerformanceSnapshot(ctx context.Context, portfolioID uuid.UUID) (*PerformanceSnapshot, error)
	UpdatePerformanceSnapshots(ctx context.Context, portfolioIDs []uuid.UUID, asOfDate time.Time) error

	// Comparative analysis
	ComparePortfolioPerformance(ctx context.Context, portfolioIDs []uuid.UUID, timeRange PerformanceTimeRange) (map[uuid.UUID]*PerformanceMetrics, error)
	GetTopPerformingAssets(ctx context.Context, portfolioID uuid.UUID, limit int, timeRange PerformanceTimeRange) ([]model.Position, error)
	GetWorstPerformingAssets(ctx context.Context, portfolioID uuid.UUID, limit int, timeRange PerformanceTimeRange) ([]model.Position, error)

	// Benchmark comparison
	CalculateBenchmarkComparison(ctx context.Context, portfolioID uuid.UUID, benchmarkAssetID uuid.UUID, timeRange PerformanceTimeRange) (*BenchmarkComparison, error)

	// Performance analytics
	CalculateRiskMetrics(ctx context.Context, portfolioID uuid.UUID, timeRange PerformanceTimeRange) (*RiskMetrics, error)
	GeneratePerformanceReport(ctx context.Context, portfolioID uuid.UUID, reportType ReportType, timeRange PerformanceTimeRange) (*PerformanceReport, error)
}

// Service-level types that wrap repository types with additional business logic

// PerformanceMetrics represents calculated performance metrics with business validation
type PerformanceMetrics struct {
	*repository.PerformanceMetrics
	IsValid           bool                       `json:"is_valid"`
	ValidationErrors  []string                   `json:"validation_errors,omitempty"`
	DataQuality       DataQuality                `json:"data_quality"`
	CalculationMethod CalculationMethod          `json:"calculation_method"`
	Benchmarks        map[string]decimal.Decimal `json:"benchmarks,omitempty"`
}

// AllocationBreakdown represents asset allocation analysis with business insights
type AllocationBreakdown struct {
	*repository.AllocationBreakdown
	RebalanceRecommendations []RebalanceRecommendation `json:"rebalance_recommendations,omitempty"`
	RiskAnalysis             AllocationRiskAnalysis    `json:"risk_analysis"`
	DiversificationScore     decimal.Decimal           `json:"diversification_score"`
}

// AssetAllocation represents individual asset allocation with enhanced metrics
type AssetAllocation struct {
	*repository.AssetAllocation
	PerformanceContribution decimal.Decimal  `json:"performance_contribution"`
	RiskContribution        decimal.Decimal  `json:"risk_contribution"`
	RecommendedWeight       *decimal.Decimal `json:"recommended_weight,omitempty"`
}

// PerformanceSnapshot represents a performance snapshot with validation
type PerformanceSnapshot struct {
	*repository.PerformanceSnapshot
	DataQuality DataQuality `json:"data_quality"`
}

// PerformanceTimeRange represents a time range for performance calculations
type PerformanceTimeRange struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// BenchmarkComparison represents performance comparison against a benchmark
type BenchmarkComparison struct {
	*repository.BenchmarkComparison
	OutperformancePeriods []PerformanceTimeRange `json:"outperformance_periods"`
	RiskAdjustedAlpha     decimal.Decimal        `json:"risk_adjusted_alpha"`
}

// Supporting types for enhanced business logic

type DataQuality struct {
	Score               decimal.Decimal `json:"score"` // 0-100
	MissingDataPoints   int             `json:"missing_data_points"`
	StaleDataPoints     int             `json:"stale_data_points"`
	EstimatedDataPoints int             `json:"estimated_data_points"`
	LastUpdated         time.Time       `json:"last_updated"`
}

type CalculationMethod struct {
	Method      string            `json:"method"`
	Parameters  map[string]string `json:"parameters"`
	Assumptions []string          `json:"assumptions"`
}

type RebalanceRecommendation struct {
	AssetType         model.AssetType `json:"asset_type"`
	CurrentWeight     decimal.Decimal `json:"current_weight"`
	TargetWeight      decimal.Decimal `json:"target_weight"`
	RecommendedAction string          `json:"recommended_action"` // "BUY", "SELL", "HOLD"
	Amount            model.Money     `json:"amount"`
	Reason            string          `json:"reason"`
}

type AllocationRiskAnalysis struct {
	ConcentrationRisk decimal.Decimal                     `json:"concentration_risk"`
	CorrelationRisk   decimal.Decimal                     `json:"correlation_risk"`
	LiquidityRisk     decimal.Decimal                     `json:"liquidity_risk"`
	RiskByAssetType   map[model.AssetType]decimal.Decimal `json:"risk_by_asset_type"`
}

type RiskMetrics struct {
	Volatility        decimal.Decimal `json:"volatility"`
	SharpeRatio       decimal.Decimal `json:"sharpe_ratio"`
	SortinoRatio      decimal.Decimal `json:"sortino_ratio"`
	MaxDrawdown       decimal.Decimal `json:"max_drawdown"`
	ValueAtRisk       decimal.Decimal `json:"value_at_risk"`
	ConditionalVaR    decimal.Decimal `json:"conditional_var"`
	Beta              decimal.Decimal `json:"beta"`
	Alpha             decimal.Decimal `json:"alpha"`
	TrackingError     decimal.Decimal `json:"tracking_error"`
	InformationRatio  decimal.Decimal `json:"information_ratio"`
	CalmarRatio       decimal.Decimal `json:"calmar_ratio"`
	DownsideDeviation decimal.Decimal `json:"downside_deviation"`
}

type ReportType string

const (
	ReportTypeDaily     ReportType = "DAILY"
	ReportTypeWeekly    ReportType = "WEEKLY"
	ReportTypeMonthly   ReportType = "MONTHLY"
	ReportTypeQuarterly ReportType = "QUARTERLY"
	ReportTypeAnnual    ReportType = "ANNUAL"
	ReportTypeCustom    ReportType = "CUSTOM"
)

type PerformanceReport struct {
	PortfolioID     uuid.UUID                       `json:"portfolio_id"`
	ReportType      ReportType                      `json:"report_type"`
	TimeRange       PerformanceTimeRange            `json:"time_range"`
	GeneratedAt     time.Time                       `json:"generated_at"`
	Metrics         *PerformanceMetrics             `json:"metrics"`
	Allocation      *AllocationBreakdown            `json:"allocation"`
	RiskMetrics     *RiskMetrics                    `json:"risk_metrics"`
	TopPerformers   []model.Position                `json:"top_performers"`
	WorstPerformers []model.Position                `json:"worst_performers"`
	Benchmarks      map[string]*BenchmarkComparison `json:"benchmarks"`
	Recommendations []string                        `json:"recommendations"`
	DataQuality     DataQuality                     `json:"data_quality"`
}

// CalculatePortfolioPerformance calculates comprehensive performance metrics for a portfolio
func (s *PerformanceService) CalculatePortfolioPerformance(ctx context.Context, portfolioID uuid.UUID, asOfDate *time.Time) (*PerformanceMetrics, error) {
	if portfolioID == uuid.Nil {
		return nil, errors.New("portfolio ID is required")
	}

	// Use current time if no date specified
	calculationDate := time.Now()
	if asOfDate != nil {
		calculationDate = *asOfDate
	}

	// Get raw performance metrics from repository
	repoMetrics, err := s.performanceRepo.CalculatePortfolioPerformance(ctx, portfolioID, calculationDate)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate portfolio performance: %w", err)
	}

	// Validate data quality
	dataQuality, validationErrors := s.validatePerformanceData(ctx, portfolioID, calculationDate)

	// Determine calculation method
	calculationMethod := CalculationMethod{
		Method: "TIME_WEIGHTED_RETURN",
		Parameters: map[string]string{
			"as_of_date": calculationDate.Format(time.RFC3339),
		},
		Assumptions: []string{
			"Uses time-weighted return methodology",
			"Assumes reinvestment of dividends",
			"Market prices as of calculation date",
		},
	}

	// Add benchmark comparisons if available
	benchmarks := make(map[string]decimal.Decimal)
	// TODO: Add common benchmark comparisons (S&P 500, etc.)

	return &PerformanceMetrics{
		PerformanceMetrics: repoMetrics,
		IsValid:            len(validationErrors) == 0,
		ValidationErrors:   validationErrors,
		DataQuality:        dataQuality,
		CalculationMethod:  calculationMethod,
		Benchmarks:         benchmarks,
	}, nil
}

// CalculateTimeWeightedReturn calculates the time-weighted return for a portfolio
func (s *PerformanceService) CalculateTimeWeightedReturn(ctx context.Context, portfolioID uuid.UUID, timeRange PerformanceTimeRange) (decimal.Decimal, error) {
	if portfolioID == uuid.Nil {
		return decimal.Zero, errors.New("portfolio ID is required")
	}

	if err := s.validateTimeRange(timeRange); err != nil {
		return decimal.Zero, fmt.Errorf("invalid time range: %w", err)
	}

	twr, err := s.performanceRepo.CalculateTimeWeightedReturn(ctx, portfolioID, timeRange.Start, timeRange.End)
	if err != nil {
		return decimal.Zero, fmt.Errorf("failed to calculate time-weighted return: %w", err)
	}

	return twr, nil
}

// CalculateVolatility calculates the volatility (standard deviation of returns) for a portfolio
func (s *PerformanceService) CalculateVolatility(ctx context.Context, portfolioID uuid.UUID, days int) (decimal.Decimal, error) {
	if portfolioID == uuid.Nil {
		return decimal.Zero, errors.New("portfolio ID is required")
	}

	if days <= 0 {
		return decimal.Zero, errors.New("days must be positive")
	}

	volatility, err := s.performanceRepo.CalculateVolatility(ctx, portfolioID, days)
	if err != nil {
		return decimal.Zero, fmt.Errorf("failed to calculate volatility: %w", err)
	}

	return volatility, nil
}

// CalculateSharpeRatio calculates the Sharpe ratio for a portfolio
func (s *PerformanceService) CalculateSharpeRatio(ctx context.Context, portfolioID uuid.UUID, riskFreeRate decimal.Decimal, days int) (decimal.Decimal, error) {
	if portfolioID == uuid.Nil {
		return decimal.Zero, errors.New("portfolio ID is required")
	}

	// Get portfolio return (annualized)
	endDate := time.Now()
	startDate := endDate.AddDate(-1, 0, 0) // 1 year back
	portfolioReturn, err := s.CalculateTimeWeightedReturn(ctx, portfolioID, PerformanceTimeRange{Start: startDate, End: endDate})
	if err != nil {
		return decimal.Zero, fmt.Errorf("failed to get portfolio return: %w", err)
	}

	// Get volatility
	volatility, err := s.CalculateVolatility(ctx, portfolioID, days)
	if err != nil {
		return decimal.Zero, fmt.Errorf("failed to get volatility: %w", err)
	}

	// Calculate Sharpe ratio: (Portfolio Return - Risk Free Rate) / Volatility
	if volatility.IsZero() {
		return decimal.Zero, nil
	}

	sharpeRatio := portfolioReturn.Sub(riskFreeRate).Div(volatility)
	return sharpeRatio, nil
}

// CalculateMaxDrawdown calculates the maximum drawdown for a portfolio
func (s *PerformanceService) CalculateMaxDrawdown(ctx context.Context, portfolioID uuid.UUID, timeRange PerformanceTimeRange) (decimal.Decimal, error) {
	if portfolioID == uuid.Nil {
		return decimal.Zero, errors.New("portfolio ID is required")
	}

	if err := s.validateTimeRange(timeRange); err != nil {
		return decimal.Zero, fmt.Errorf("invalid time range: %w", err)
	}

	maxDrawdown, err := s.performanceRepo.CalculateMaxDrawdown(ctx, portfolioID, timeRange.Start, timeRange.End)
	if err != nil {
		return decimal.Zero, fmt.Errorf("failed to calculate max drawdown: %w", err)
	}

	return maxDrawdown, nil
}

// CalculateAssetAllocation calculates the asset allocation for a portfolio with business insights
func (s *PerformanceService) CalculateAssetAllocation(ctx context.Context, portfolioID uuid.UUID, asOfDate *time.Time) (*AllocationBreakdown, error) {
	if portfolioID == uuid.Nil {
		return nil, errors.New("portfolio ID is required")
	}

	calculationDate := time.Now()
	if asOfDate != nil {
		calculationDate = *asOfDate
	}

	// Get raw allocation from repository
	repoAllocation, err := s.performanceRepo.CalculateAssetAllocation(ctx, portfolioID, calculationDate)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate asset allocation: %w", err)
	}

	// Calculate diversification score
	diversificationScore := s.calculateDiversificationScore(repoAllocation.Allocations)

	// Generate rebalance recommendations
	recommendations := s.generateRebalanceRecommendations(repoAllocation.Allocations)

	// Calculate risk analysis
	riskAnalysis := s.calculateAllocationRiskAnalysis(ctx, portfolioID, repoAllocation.Allocations)

	return &AllocationBreakdown{
		AllocationBreakdown:      repoAllocation,
		RebalanceRecommendations: recommendations,
		RiskAnalysis:             riskAnalysis,
		DiversificationScore:     diversificationScore,
	}, nil
}

// CalculateAllocationByType calculates allocation breakdown by asset type
func (s *PerformanceService) CalculateAllocationByType(ctx context.Context, portfolioID uuid.UUID) ([]AssetAllocation, error) {
	if portfolioID == uuid.Nil {
		return nil, errors.New("portfolio ID is required")
	}

	repoAllocations, err := s.performanceRepo.CalculateAllocationByType(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate allocation by type: %w", err)
	}

	// Enhance with business metrics
	result := make([]AssetAllocation, len(repoAllocations))
	for i, alloc := range repoAllocations {
		result[i] = AssetAllocation{
			AssetAllocation: &alloc,
			// TODO: Calculate performance and risk contributions
			PerformanceContribution: decimal.Zero,
			RiskContribution:        decimal.Zero,
		}
	}

	return result, nil
}

// CalculateAllocationBySector calculates allocation breakdown by sector
func (s *PerformanceService) CalculateAllocationBySector(ctx context.Context, portfolioID uuid.UUID) ([]AssetAllocation, error) {
	if portfolioID == uuid.Nil {
		return nil, errors.New("portfolio ID is required")
	}

	repoAllocations, err := s.performanceRepo.CalculateAllocationBySector(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate allocation by sector: %w", err)
	}

	// Convert to service-level type
	result := make([]AssetAllocation, len(repoAllocations))
	for i, alloc := range repoAllocations {
		result[i] = AssetAllocation{
			AssetAllocation: &alloc,
		}
	}

	return result, nil
}

// CalculateAllocationByGeography calculates allocation breakdown by geography
func (s *PerformanceService) CalculateAllocationByGeography(ctx context.Context, portfolioID uuid.UUID) ([]AssetAllocation, error) {
	if portfolioID == uuid.Nil {
		return nil, errors.New("portfolio ID is required")
	}

	repoAllocations, err := s.performanceRepo.CalculateAllocationByGeography(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate allocation by geography: %w", err)
	}

	// Convert to service-level type
	result := make([]AssetAllocation, len(repoAllocations))
	for i, alloc := range repoAllocations {
		result[i] = AssetAllocation{
			AssetAllocation: &alloc,
		}
	}

	return result, nil
}

// CreatePerformanceSnapshot creates a new performance snapshot with validation
func (s *PerformanceService) CreatePerformanceSnapshot(ctx context.Context, portfolioID uuid.UUID, asOfDate time.Time) (*PerformanceSnapshot, error) {
	if portfolioID == uuid.Nil {
		return nil, errors.New("portfolio ID is required")
	}

	// Calculate performance metrics for the snapshot
	metrics, err := s.CalculatePortfolioPerformance(ctx, portfolioID, &asOfDate)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate performance for snapshot: %w", err)
	}

	// Create repository snapshot
	repoSnapshot := &repository.PerformanceSnapshot{
		PortfolioID:        portfolioID,
		TotalValue:         metrics.TotalValue,
		TotalCostBasis:     metrics.TotalCostBasis,
		UnrealizedGainLoss: metrics.UnrealizedGainLoss,
		RealizedGainLoss:   metrics.RealizedGainLoss,
		ReturnPercentage:   metrics.TotalReturnPercentage,
		SnapshotDate:       asOfDate,
		CreatedAt:          time.Now(),
	}

	if err := s.performanceRepo.CreatePerformanceSnapshot(ctx, repoSnapshot); err != nil {
		return nil, fmt.Errorf("failed to create performance snapshot: %w", err)
	}

	return &PerformanceSnapshot{
		PerformanceSnapshot: repoSnapshot,
		DataQuality:         metrics.DataQuality,
	}, nil
}

// GetPerformanceSnapshots retrieves performance snapshots for a date range
func (s *PerformanceService) GetPerformanceSnapshots(ctx context.Context, portfolioID uuid.UUID, timeRange PerformanceTimeRange) ([]PerformanceSnapshot, error) {
	if portfolioID == uuid.Nil {
		return nil, errors.New("portfolio ID is required")
	}

	if err := s.validateTimeRange(timeRange); err != nil {
		return nil, fmt.Errorf("invalid time range: %w", err)
	}

	repoSnapshots, err := s.performanceRepo.GetPerformanceSnapshots(ctx, portfolioID, timeRange.Start, timeRange.End)
	if err != nil {
		return nil, fmt.Errorf("failed to get performance snapshots: %w", err)
	}

	// Convert to service-level type
	result := make([]PerformanceSnapshot, len(repoSnapshots))
	for i, snapshot := range repoSnapshots {
		result[i] = PerformanceSnapshot{
			PerformanceSnapshot: &snapshot,
			// TODO: Calculate data quality for historical snapshots
			DataQuality: DataQuality{Score: decimal.NewFromInt(100)},
		}
	}

	return result, nil
}

// GetLatestPerformanceSnapshot retrieves the most recent performance snapshot
func (s *PerformanceService) GetLatestPerformanceSnapshot(ctx context.Context, portfolioID uuid.UUID) (*PerformanceSnapshot, error) {
	if portfolioID == uuid.Nil {
		return nil, errors.New("portfolio ID is required")
	}

	repoSnapshot, err := s.performanceRepo.GetLatestPerformanceSnapshot(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest performance snapshot: %w", err)
	}

	return &PerformanceSnapshot{
		PerformanceSnapshot: repoSnapshot,
		DataQuality:         DataQuality{Score: decimal.NewFromInt(100)},
	}, nil
}

// UpdatePerformanceSnapshots updates performance snapshots for multiple portfolios
func (s *PerformanceService) UpdatePerformanceSnapshots(ctx context.Context, portfolioIDs []uuid.UUID, asOfDate time.Time) error {
	if len(portfolioIDs) == 0 {
		return errors.New("at least one portfolio ID is required")
	}

	// Validate all portfolio IDs
	for _, portfolioID := range portfolioIDs {
		if portfolioID == uuid.Nil {
			return errors.New("invalid portfolio ID found")
		}
	}

	if err := s.performanceRepo.UpdatePerformanceSnapshots(ctx, portfolioIDs, asOfDate); err != nil {
		return fmt.Errorf("failed to update performance snapshots: %w", err)
	}

	return nil
}

// ComparePortfolioPerformance compares performance across multiple portfolios
func (s *PerformanceService) ComparePortfolioPerformance(ctx context.Context, portfolioIDs []uuid.UUID, timeRange PerformanceTimeRange) (map[uuid.UUID]*PerformanceMetrics, error) {
	if len(portfolioIDs) == 0 {
		return nil, errors.New("at least one portfolio ID is required")
	}

	if err := s.validateTimeRange(timeRange); err != nil {
		return nil, fmt.Errorf("invalid time range: %w", err)
	}

	repoMetrics, err := s.performanceRepo.ComparePortfolioPerformance(ctx, portfolioIDs, timeRange.Start, timeRange.End)
	if err != nil {
		return nil, fmt.Errorf("failed to compare portfolio performance: %w", err)
	}

	// Convert to service-level type with enhanced metrics
	result := make(map[uuid.UUID]*PerformanceMetrics)
	for portfolioID, metrics := range repoMetrics {
		dataQuality, validationErrors := s.validatePerformanceData(ctx, portfolioID, timeRange.End)

		result[portfolioID] = &PerformanceMetrics{
			PerformanceMetrics: metrics,
			IsValid:            len(validationErrors) == 0,
			ValidationErrors:   validationErrors,
			DataQuality:        dataQuality,
			CalculationMethod: CalculationMethod{
				Method: "COMPARATIVE_ANALYSIS",
				Parameters: map[string]string{
					"start_date": timeRange.Start.Format(time.RFC3339),
					"end_date":   timeRange.End.Format(time.RFC3339),
				},
			},
		}
	}

	return result, nil
}

// GetTopPerformingAssets retrieves the best performing assets in a portfolio
func (s *PerformanceService) GetTopPerformingAssets(ctx context.Context, portfolioID uuid.UUID, limit int, timeRange PerformanceTimeRange) ([]model.Position, error) {
	if portfolioID == uuid.Nil {
		return nil, errors.New("portfolio ID is required")
	}

	if limit <= 0 {
		limit = 10 // Default limit
	}

	if err := s.validateTimeRange(timeRange); err != nil {
		return nil, fmt.Errorf("invalid time range: %w", err)
	}

	repoTimeRange := repository.TimeRange{
		Start: timeRange.Start,
		End:   timeRange.End,
	}

	positions, err := s.performanceRepo.GetTopPerformingAssets(ctx, portfolioID, limit, repoTimeRange)
	if err != nil {
		return nil, fmt.Errorf("failed to get top performing assets: %w", err)
	}

	return positions, nil
}

// GetWorstPerformingAssets retrieves the worst performing assets in a portfolio
func (s *PerformanceService) GetWorstPerformingAssets(ctx context.Context, portfolioID uuid.UUID, limit int, timeRange PerformanceTimeRange) ([]model.Position, error) {
	if portfolioID == uuid.Nil {
		return nil, errors.New("portfolio ID is required")
	}

	if limit <= 0 {
		limit = 10 // Default limit
	}

	if err := s.validateTimeRange(timeRange); err != nil {
		return nil, fmt.Errorf("invalid time range: %w", err)
	}

	repoTimeRange := repository.TimeRange{
		Start: timeRange.Start,
		End:   timeRange.End,
	}

	positions, err := s.performanceRepo.GetWorstPerformingAssets(ctx, portfolioID, limit, repoTimeRange)
	if err != nil {
		return nil, fmt.Errorf("failed to get worst performing assets: %w", err)
	}

	return positions, nil
}

// CalculateBenchmarkComparison compares portfolio performance against a benchmark
func (s *PerformanceService) CalculateBenchmarkComparison(ctx context.Context, portfolioID uuid.UUID, benchmarkAssetID uuid.UUID, timeRange PerformanceTimeRange) (*BenchmarkComparison, error) {
	if portfolioID == uuid.Nil {
		return nil, errors.New("portfolio ID is required")
	}

	if benchmarkAssetID == uuid.Nil {
		return nil, errors.New("benchmark asset ID is required")
	}

	if err := s.validateTimeRange(timeRange); err != nil {
		return nil, fmt.Errorf("invalid time range: %w", err)
	}

	repoTimeRange := repository.TimeRange{
		Start: timeRange.Start,
		End:   timeRange.End,
	}

	repoComparison, err := s.performanceRepo.CalculateBenchmarkComparison(ctx, portfolioID, benchmarkAssetID, repoTimeRange)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate benchmark comparison: %w", err)
	}

	// Calculate additional business metrics
	outperformancePeriods := s.calculateOutperformancePeriods(ctx, portfolioID, benchmarkAssetID, timeRange)
	riskAdjustedAlpha := s.calculateRiskAdjustedAlpha(repoComparison.Alpha, repoComparison.Beta)

	return &BenchmarkComparison{
		BenchmarkComparison:   repoComparison,
		OutperformancePeriods: outperformancePeriods,
		RiskAdjustedAlpha:     riskAdjustedAlpha,
	}, nil
}

// CalculateRiskMetrics calculates comprehensive risk metrics for a portfolio
func (s *PerformanceService) CalculateRiskMetrics(ctx context.Context, portfolioID uuid.UUID, timeRange PerformanceTimeRange) (*RiskMetrics, error) {
	if portfolioID == uuid.Nil {
		return nil, errors.New("portfolio ID is required")
	}

	if err := s.validateTimeRange(timeRange); err != nil {
		return nil, fmt.Errorf("invalid time range: %w", err)
	}

	// Calculate individual risk metrics
	days := int(timeRange.End.Sub(timeRange.Start).Hours() / 24)

	volatility, err := s.CalculateVolatility(ctx, portfolioID, days)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate volatility: %w", err)
	}

	riskFreeRate := decimal.NewFromFloat(2.0) // 2% risk-free rate assumption
	sharpeRatio, err := s.CalculateSharpeRatio(ctx, portfolioID, riskFreeRate, days)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate Sharpe ratio: %w", err)
	}

	maxDrawdown, err := s.CalculateMaxDrawdown(ctx, portfolioID, timeRange)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate max drawdown: %w", err)
	}

	// Calculate additional risk metrics
	sortinoRatio := s.calculateSortinoRatio(ctx, portfolioID, riskFreeRate, days)
	valueAtRisk := s.calculateValueAtRisk(ctx, portfolioID, decimal.NewFromFloat(0.05), days) // 5% VaR
	conditionalVaR := s.calculateConditionalVaR(ctx, portfolioID, decimal.NewFromFloat(0.05), days)
	calmarRatio := s.calculateCalmarRatio(sharpeRatio, maxDrawdown)
	downsideDeviation := s.calculateDownsideDeviation(ctx, portfolioID, days)

	return &RiskMetrics{
		Volatility:        volatility,
		SharpeRatio:       sharpeRatio,
		SortinoRatio:      sortinoRatio,
		MaxDrawdown:       maxDrawdown,
		ValueAtRisk:       valueAtRisk,
		ConditionalVaR:    conditionalVaR,
		Beta:              decimal.NewFromInt(1), // TODO: Calculate against market benchmark
		Alpha:             decimal.Zero,          // TODO: Calculate against market benchmark
		TrackingError:     decimal.Zero,          // TODO: Calculate against benchmark
		InformationRatio:  decimal.Zero,          // TODO: Calculate against benchmark
		CalmarRatio:       calmarRatio,
		DownsideDeviation: downsideDeviation,
	}, nil
}

// GeneratePerformanceReport generates a comprehensive performance report
func (s *PerformanceService) GeneratePerformanceReport(ctx context.Context, portfolioID uuid.UUID, reportType ReportType, timeRange PerformanceTimeRange) (*PerformanceReport, error) {
	if portfolioID == uuid.Nil {
		return nil, errors.New("portfolio ID is required")
	}

	if err := s.validateTimeRange(timeRange); err != nil {
		return nil, fmt.Errorf("invalid time range: %w", err)
	}

	// Calculate all components of the report
	metrics, err := s.CalculatePortfolioPerformance(ctx, portfolioID, &timeRange.End)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate performance metrics: %w", err)
	}

	allocation, err := s.CalculateAssetAllocation(ctx, portfolioID, &timeRange.End)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate asset allocation: %w", err)
	}

	riskMetrics, err := s.CalculateRiskMetrics(ctx, portfolioID, timeRange)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate risk metrics: %w", err)
	}

	topPerformers, err := s.GetTopPerformingAssets(ctx, portfolioID, 5, timeRange)
	if err != nil {
		return nil, fmt.Errorf("failed to get top performers: %w", err)
	}

	worstPerformers, err := s.GetWorstPerformingAssets(ctx, portfolioID, 5, timeRange)
	if err != nil {
		return nil, fmt.Errorf("failed to get worst performers: %w", err)
	}

	// Generate recommendations based on analysis
	recommendations := s.generateRecommendations(metrics, allocation, riskMetrics)

	return &PerformanceReport{
		PortfolioID:     portfolioID,
		ReportType:      reportType,
		TimeRange:       timeRange,
		GeneratedAt:     time.Now(),
		Metrics:         metrics,
		Allocation:      allocation,
		RiskMetrics:     riskMetrics,
		TopPerformers:   topPerformers,
		WorstPerformers: worstPerformers,
		Benchmarks:      make(map[string]*BenchmarkComparison), // TODO: Add benchmark comparisons
		Recommendations: recommendations,
		DataQuality:     metrics.DataQuality,
	}, nil
}

// Helper methods for business logic

func (s *PerformanceService) validateTimeRange(timeRange PerformanceTimeRange) error {
	if timeRange.Start.IsZero() || timeRange.End.IsZero() {
		return errors.New("start and end dates are required")
	}

	if timeRange.Start.After(timeRange.End) {
		return errors.New("start date must be before end date")
	}

	if timeRange.End.After(time.Now()) {
		return errors.New("end date cannot be in the future")
	}

	return nil
}

func (s *PerformanceService) validatePerformanceData(ctx context.Context, portfolioID uuid.UUID, asOfDate time.Time) (DataQuality, []string) {
	var validationErrors []string
	dataQuality := DataQuality{
		Score:       decimal.NewFromInt(100),
		LastUpdated: time.Now(),
	}

	// TODO: Implement comprehensive data quality validation
	// - Check for missing price data
	// - Check for stale data
	// - Validate position data consistency
	// - Check for data gaps

	return dataQuality, validationErrors
}

func (s *PerformanceService) calculateDiversificationScore(allocations []repository.AssetAllocation) decimal.Decimal {
	if len(allocations) == 0 {
		return decimal.Zero
	}

	// Simple diversification score based on number of asset types and their distribution
	// Higher score = better diversification

	// Calculate Herfindahl-Hirschman Index (HHI) for concentration
	var hhi decimal.Decimal
	for _, alloc := range allocations {
		weight := alloc.Percentage.Div(decimal.NewFromInt(100))
		hhi = hhi.Add(weight.Mul(weight))
	}

	// Convert HHI to diversification score (0-100)
	// Lower HHI = higher diversification
	maxHHI := decimal.NewFromInt(1) // Maximum concentration (100% in one asset)
	diversificationScore := decimal.NewFromInt(100).Mul(decimal.NewFromInt(1).Sub(hhi.Div(maxHHI)))

	return diversificationScore
}

func (s *PerformanceService) generateRebalanceRecommendations(allocations []repository.AssetAllocation) []RebalanceRecommendation {
	var recommendations []RebalanceRecommendation

	// TODO: Implement sophisticated rebalancing logic
	// - Target allocation models
	// - Risk-based rebalancing
	// - Tax-efficient rebalancing
	// - Threshold-based rebalancing

	return recommendations
}

func (s *PerformanceService) calculateAllocationRiskAnalysis(ctx context.Context, portfolioID uuid.UUID, allocations []repository.AssetAllocation) AllocationRiskAnalysis {
	// TODO: Implement comprehensive risk analysis
	// - Concentration risk (single asset/type dominance)
	// - Correlation risk (correlated assets)
	// - Liquidity risk (illiquid assets)
	// - Risk contribution by asset type

	return AllocationRiskAnalysis{
		ConcentrationRisk: decimal.Zero,
		CorrelationRisk:   decimal.Zero,
		LiquidityRisk:     decimal.Zero,
		RiskByAssetType:   make(map[model.AssetType]decimal.Decimal),
	}
}

func (s *PerformanceService) calculateOutperformancePeriods(ctx context.Context, portfolioID uuid.UUID, benchmarkAssetID uuid.UUID, timeRange PerformanceTimeRange) []PerformanceTimeRange {
	// TODO: Implement outperformance period calculation
	// - Identify periods where portfolio outperformed benchmark
	// - Calculate rolling performance comparisons

	return []PerformanceTimeRange{}
}

func (s *PerformanceService) calculateRiskAdjustedAlpha(alpha, beta decimal.Decimal) decimal.Decimal {
	// Simple risk-adjusted alpha calculation
	// TODO: Implement more sophisticated risk adjustment
	return alpha.Div(beta.Add(decimal.NewFromInt(1)))
}

func (s *PerformanceService) calculateSortinoRatio(ctx context.Context, portfolioID uuid.UUID, riskFreeRate decimal.Decimal, days int) decimal.Decimal {
	// TODO: Implement Sortino ratio calculation
	// Similar to Sharpe ratio but uses downside deviation instead of total volatility
	return decimal.Zero
}

func (s *PerformanceService) calculateValueAtRisk(ctx context.Context, portfolioID uuid.UUID, confidenceLevel decimal.Decimal, days int) decimal.Decimal {
	// TODO: Implement Value at Risk calculation
	// Calculate potential loss at given confidence level
	return decimal.Zero
}

func (s *PerformanceService) calculateConditionalVaR(ctx context.Context, portfolioID uuid.UUID, confidenceLevel decimal.Decimal, days int) decimal.Decimal {
	// TODO: Implement Conditional Value at Risk (Expected Shortfall)
	// Average loss beyond VaR threshold
	return decimal.Zero
}

func (s *PerformanceService) calculateCalmarRatio(annualizedReturn, maxDrawdown decimal.Decimal) decimal.Decimal {
	if maxDrawdown.IsZero() {
		return decimal.Zero
	}
	return annualizedReturn.Div(maxDrawdown)
}

func (s *PerformanceService) calculateDownsideDeviation(ctx context.Context, portfolioID uuid.UUID, days int) decimal.Decimal {
	// TODO: Implement downside deviation calculation
	// Standard deviation of negative returns only
	return decimal.Zero
}

func (s *PerformanceService) generateRecommendations(metrics *PerformanceMetrics, allocation *AllocationBreakdown, riskMetrics *RiskMetrics) []string {
	var recommendations []string

	// TODO: Implement intelligent recommendation engine
	// - Performance-based recommendations
	// - Risk-based recommendations
	// - Allocation-based recommendations
	// - Market condition considerations

	if metrics.TotalReturnPercentage.LessThan(decimal.Zero) {
		recommendations = append(recommendations, "Consider reviewing underperforming assets in your portfolio")
	}

	if riskMetrics.Volatility.GreaterThan(decimal.NewFromInt(20)) {
		recommendations = append(recommendations, "Portfolio volatility is high - consider diversification")
	}

	if allocation.DiversificationScore.LessThan(decimal.NewFromInt(60)) {
		recommendations = append(recommendations, "Portfolio could benefit from better diversification across asset types")
	}

	return recommendations
}
