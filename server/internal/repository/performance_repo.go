package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

// PerformanceMetrics represents calculated performance metrics
type PerformanceMetrics struct {
	PortfolioID           string          `json:"portfolio_id"`
	TotalValue            model.Money     `json:"total_value"`
	TotalCostBasis        model.Money     `json:"total_cost_basis"`
	UnrealizedGainLoss    model.Money     `json:"unrealized_gain_loss"`
	RealizedGainLoss      model.Money     `json:"realized_gain_loss"`
	TotalReturn           decimal.Decimal `json:"total_return"`
	TotalReturnPercentage decimal.Decimal `json:"total_return_percentage"`
	TimeWeightedReturn    decimal.Decimal `json:"time_weighted_return"`
	AnnualizedReturn      decimal.Decimal `json:"annualized_return"`
	Volatility            decimal.Decimal `json:"volatility"`
	SharpeRatio           decimal.Decimal `json:"sharpe_ratio"`
	MaxDrawdown           decimal.Decimal `json:"max_drawdown"`
	CalculationDate       time.Time       `json:"calculation_date"`
}

// AllocationBreakdown represents asset allocation analysis
type AllocationBreakdown struct {
	PortfolioID     string            `json:"portfolio_id"`
	TotalValue      model.Money       `json:"total_value"`
	Allocations     []AssetAllocation `json:"allocations"`
	CalculationDate time.Time         `json:"calculation_date"`
}

// PerformanceSnapshot represents a daily performance snapshot
type PerformanceSnapshot struct {
	ID                 int64           `json:"id"`
	PortfolioID        string          `json:"portfolio_id"`
	TotalValue         model.Money     `json:"total_value"`
	TotalCostBasis     model.Money     `json:"total_cost_basis"`
	UnrealizedGainLoss model.Money     `json:"unrealized_gain_loss"`
	RealizedGainLoss   model.Money     `json:"realized_gain_loss"`
	ReturnPercentage   decimal.Decimal `json:"return_percentage"`
	SnapshotDate       time.Time       `json:"snapshot_date"`
	CreatedAt          time.Time       `json:"created_at"`
}

// PositionPerformanceResult carries position data with calculated performance metrics
type PositionPerformanceResult struct {
	PositionID       string           `bun:"position_id"`
	AssetID          string           `bun:"asset_id"`
	AssetName        string           `bun:"asset_name"`
	AssetSymbol      *string          `bun:"asset_symbol"`
	AssetType        model.AssetType  `bun:"asset_type"`
	Quantity         decimal.Decimal  `bun:"quantity"`
	AverageCostBasis *decimal.Decimal `bun:"average_cost_basis"` // cost per unit (decimal, like 150.25)
	TotalCostBasis   *int64           `bun:"total_cost_basis"`   // total cost in cents
	CurrentPrice     decimal.Decimal  `bun:"current_price"`      // latest market price
	ReturnPercentage decimal.Decimal  `bun:"return_percentage"`  // (current - cost_basis) / cost_basis * 100
	GainLoss         int64            `bun:"gain_loss"`          // in cents
	Contribution     decimal.Decimal  `bun:"contribution"`       // % of portfolio
}

// IPerformanceRepository defines the interface for performance calculation operations
type IPerformanceRepository interface {
	// Performance calculations
	CalculatePortfolioPerformance(ctx context.Context, portfolioID string, asOfDate time.Time) (*PerformanceMetrics, error)
	CalculateTimeWeightedReturn(ctx context.Context, portfolioID string, startDate, endDate time.Time) (decimal.Decimal, error)
	CalculateVolatility(ctx context.Context, portfolioID string, days int) (decimal.Decimal, error)
	CalculateMaxDrawdown(ctx context.Context, portfolioID string, startDate, endDate time.Time) (decimal.Decimal, error)

	// Allocation calculations
	CalculateAssetAllocation(ctx context.Context, portfolioID string, asOfDate time.Time) (*AllocationBreakdown, error)
	CalculateAllocationByType(ctx context.Context, portfolioID string) ([]AssetAllocation, error)
	CalculateAllocationBySector(ctx context.Context, portfolioID string) ([]AssetAllocation, error)
	CalculateAllocationByGeography(ctx context.Context, portfolioID string) ([]AssetAllocation, error)

	// Performance snapshots
	CreatePerformanceSnapshot(ctx context.Context, snapshot *PerformanceSnapshot) error
	GetPerformanceSnapshots(ctx context.Context, portfolioID string, startDate, endDate time.Time) ([]PerformanceSnapshot, error)
	GetLatestPerformanceSnapshot(ctx context.Context, portfolioID string) (*PerformanceSnapshot, error)
	UpdatePerformanceSnapshots(ctx context.Context, portfolioIDs []string, asOfDate time.Time) error
	CalculateAndSaveHistoricalSnapshots(ctx context.Context, portfolioID string, startDate, endDate time.Time) error

	// Comparative analysis
	ComparePortfolioPerformance(ctx context.Context, portfolioIDs []string, startDate, endDate time.Time) (map[string]*PerformanceMetrics, error)
	GetTopPerformingAssets(ctx context.Context, portfolioID string, limit int, timeRange TimeRange) ([]PositionPerformanceResult, error)
	GetWorstPerformingAssets(ctx context.Context, portfolioID string, limit int, timeRange TimeRange) ([]PositionPerformanceResult, error)

	// Benchmark comparison
	CalculateBenchmarkComparison(ctx context.Context, portfolioID string, benchmarkAssetID string, timeRange TimeRange) (*BenchmarkComparison, error)
}

// BenchmarkComparison represents performance comparison against a benchmark
type BenchmarkComparison struct {
	PortfolioID      string          `json:"portfolio_id"`
	BenchmarkAssetID string          `json:"benchmark_asset_id"`
	PortfolioReturn  decimal.Decimal `json:"portfolio_return"`
	BenchmarkReturn  decimal.Decimal `json:"benchmark_return"`
	Alpha            decimal.Decimal `json:"alpha"`
	Beta             decimal.Decimal `json:"beta"`
	TrackingError    decimal.Decimal `json:"tracking_error"`
	InformationRatio decimal.Decimal `json:"information_ratio"`
	CorrelationCoeff decimal.Decimal `json:"correlation_coefficient"`
	StartDate        time.Time       `json:"start_date"`
	EndDate          time.Time       `json:"end_date"`
}

// PerformanceRepository is the concrete implementation of IPerformanceRepository
type PerformanceRepository struct {
	db bun.IDB
}

// NewPerformanceRepository creates a new PerformanceRepository
func NewPerformanceRepository(db bun.IDB) *PerformanceRepository {
	return &PerformanceRepository{db: db}
}

// CalculatePortfolioPerformance calculates comprehensive performance metrics for a portfolio
func (r *PerformanceRepository) CalculatePortfolioPerformance(ctx context.Context, portfolioID string, asOfDate time.Time) (*PerformanceMetrics, error) {
	// Get current portfolio value and cost basis
	var portfolioData struct {
		TotalValue         int64 `bun:"total_value"`
		TotalCostBasis     int64 `bun:"total_cost_basis"`
		UnrealizedGainLoss int64 `bun:"unrealized_gain_loss"`
	}

	err := r.db.NewSelect().
		ColumnExpr("COALESCE(SUM(p.quantity * COALESCE(ap.price, 0) * p.ownership_percentage / 100), 0) * 100 as total_value").
		ColumnExpr("COALESCE(SUM(p.total_cost_basis), 0) as total_cost_basis").
		ColumnExpr("COALESCE(SUM(p.quantity * COALESCE(ap.price, 0) * p.ownership_percentage / 100), 0) * 100 - COALESCE(SUM(p.total_cost_basis), 0) as unrealized_gain_loss").
		Model((*model.Position)(nil)).
		TableExpr("sigma_finance.positions p").
		Join("LEFT JOIN sigma_finance.assets a ON a.id = p.asset_id").
		Join("LEFT JOIN LATERAL (SELECT price FROM sigma_finance.asset_prices WHERE asset_id = a.id AND timestamp <= ? ORDER BY timestamp DESC LIMIT 1) ap ON true", asOfDate).
		Where("p.portfolio_id = ?", portfolioID).
		Scan(ctx, &portfolioData)
	if err != nil {
		return nil, err
	}

	// Get realized gains from transactions
	var realizedGains int64
	err = r.db.NewSelect().
		ColumnExpr("COALESCE(SUM(t.amount), 0)").
		Model((*model.Transaction)(nil)).
		TableExpr("sigma_finance.transactions t").
		Join("JOIN sigma_finance.positions p ON p.id = t.position_id").
		Where("p.portfolio_id = ?", portfolioID).
		Where("t.type = 'SELL'").
		Where("t.executed_at <= ?", asOfDate).
		Scan(ctx, &realizedGains)
	if err != nil {
		return nil, err
	}

	// Calculate basic metrics
	totalValue := model.Money(portfolioData.TotalValue)
	totalCostBasis := model.Money(portfolioData.TotalCostBasis)
	unrealizedGainLoss := model.Money(portfolioData.UnrealizedGainLoss)
	realizedGainLossAmount := model.Money(realizedGains)

	totalReturn := unrealizedGainLoss + realizedGainLossAmount
	totalReturnDecimal := decimal.NewFromInt(int64(totalReturn))
	var totalReturnPercentage decimal.Decimal
	if totalCostBasis > 0 {
		totalReturnPercentage = decimal.NewFromInt(int64(totalReturn)).
			Div(decimal.NewFromInt(int64(totalCostBasis))).
			Mul(decimal.NewFromInt(100))
	}

	// Calculate time-weighted return (simplified version)
	timeWeightedReturn, err := r.CalculateTimeWeightedReturn(ctx, portfolioID, asOfDate.AddDate(-1, 0, 0), asOfDate)
	if err != nil {
		timeWeightedReturn = totalReturnPercentage // Fallback to total return
	}

	// Calculate annualized return (simplified)
	annualizedReturn := timeWeightedReturn // For now, use TWR as annualized return

	// Calculate volatility (30-day)
	volatility, err := r.CalculateVolatility(ctx, portfolioID, 30)
	if err != nil {
		volatility = decimal.Zero
	}

	// Calculate Sharpe ratio (assuming 2% risk-free rate)
	riskFreeRate := decimal.NewFromFloat(2.0)
	var sharpeRatio decimal.Decimal
	if !volatility.IsZero() {
		sharpeRatio = annualizedReturn.Sub(riskFreeRate).Div(volatility)
	}

	// Calculate max drawdown (1-year period)
	maxDrawdown, err := r.CalculateMaxDrawdown(ctx, portfolioID, asOfDate.AddDate(-1, 0, 0), asOfDate)
	if err != nil {
		maxDrawdown = decimal.Zero
	}

	return &PerformanceMetrics{
		PortfolioID:           portfolioID,
		TotalValue:            totalValue,
		TotalCostBasis:        totalCostBasis,
		UnrealizedGainLoss:    unrealizedGainLoss,
		RealizedGainLoss:      realizedGainLossAmount,
		TotalReturn:           totalReturnDecimal,
		TotalReturnPercentage: totalReturnPercentage,
		TimeWeightedReturn:    timeWeightedReturn,
		AnnualizedReturn:      annualizedReturn,
		Volatility:            volatility,
		SharpeRatio:           sharpeRatio,
		MaxDrawdown:           maxDrawdown,
		CalculationDate:       asOfDate,
	}, nil
}

// CalculateTimeWeightedReturn calculates the time-weighted return for a portfolio
func (r *PerformanceRepository) CalculateTimeWeightedReturn(ctx context.Context, portfolioID string, startDate, endDate time.Time) (decimal.Decimal, error) {
	// Get performance snapshots for the period
	snapshots, err := r.GetPerformanceSnapshots(ctx, portfolioID, startDate, endDate)
	if err != nil || len(snapshots) < 2 {
		return decimal.Zero, err
	}

	// Calculate geometric mean of daily returns
	var product decimal.Decimal = decimal.NewFromInt(1)

	for i := 1; i < len(snapshots); i++ {
		prev := snapshots[i-1]
		curr := snapshots[i]

		if prev.TotalValue > 0 {
			dailyReturn := decimal.NewFromInt(int64(curr.TotalValue)).
				Div(decimal.NewFromInt(int64(prev.TotalValue))).
				Sub(decimal.NewFromInt(1))

			product = product.Mul(decimal.NewFromInt(1).Add(dailyReturn))
		}
	}

	// Convert to percentage
	twr := product.Sub(decimal.NewFromInt(1)).Mul(decimal.NewFromInt(100))
	return twr, nil
}

// CalculateVolatility calculates the volatility (standard deviation of returns) for a portfolio
func (r *PerformanceRepository) CalculateVolatility(ctx context.Context, portfolioID string, days int) (decimal.Decimal, error) {
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -days)

	snapshots, err := r.GetPerformanceSnapshots(ctx, portfolioID, startDate, endDate)
	if err != nil || len(snapshots) < 2 {
		return decimal.Zero, err
	}

	// Calculate daily returns
	var returns []decimal.Decimal
	for i := 1; i < len(snapshots); i++ {
		prev := snapshots[i-1]
		curr := snapshots[i]

		if prev.TotalValue > 0 {
			dailyReturn := decimal.NewFromInt(int64(curr.TotalValue)).
				Div(decimal.NewFromInt(int64(prev.TotalValue))).
				Sub(decimal.NewFromInt(1))
			returns = append(returns, dailyReturn)
		}
	}

	if len(returns) == 0 {
		return decimal.Zero, nil
	}

	// Calculate mean return
	var sum decimal.Decimal
	for _, ret := range returns {
		sum = sum.Add(ret)
	}
	mean := sum.Div(decimal.NewFromInt(int64(len(returns))))

	// Calculate variance
	var varianceSum decimal.Decimal
	for _, ret := range returns {
		diff := ret.Sub(mean)
		varianceSum = varianceSum.Add(diff.Mul(diff))
	}
	variance := varianceSum.Div(decimal.NewFromInt(int64(len(returns) - 1)))

	// Calculate standard deviation (volatility) using Newton's method approximation
	volatility := decimal.Zero
	if variance.GreaterThan(decimal.Zero) {
		// Simple square root approximation using Newton's method
		x := variance.Div(decimal.NewFromInt(2))
		for i := 0; i < 10; i++ { // 10 iterations should be sufficient for financial calculations
			x = x.Add(variance.Div(x)).Div(decimal.NewFromInt(2))
		}
		volatility = x.Mul(decimal.NewFromInt(100)) // Convert to percentage
	}

	return volatility, nil
}

// CalculateMaxDrawdown calculates the maximum drawdown for a portfolio
func (r *PerformanceRepository) CalculateMaxDrawdown(ctx context.Context, portfolioID string, startDate, endDate time.Time) (decimal.Decimal, error) {
	snapshots, err := r.GetPerformanceSnapshots(ctx, portfolioID, startDate, endDate)
	if err != nil || len(snapshots) == 0 {
		return decimal.Zero, err
	}

	var maxDrawdown decimal.Decimal
	var peak model.Money

	for _, snapshot := range snapshots {
		if snapshot.TotalValue > peak {
			peak = snapshot.TotalValue
		}

		if peak > 0 {
			drawdown := decimal.NewFromInt(int64(peak - snapshot.TotalValue)).
				Div(decimal.NewFromInt(int64(peak))).
				Mul(decimal.NewFromInt(100))

			if drawdown.GreaterThan(maxDrawdown) {
				maxDrawdown = drawdown
			}
		}
	}

	return maxDrawdown, nil
}

// CalculateAssetAllocation calculates the asset allocation for a portfolio
func (r *PerformanceRepository) CalculateAssetAllocation(ctx context.Context, portfolioID string, asOfDate time.Time) (*AllocationBreakdown, error) {
	allocations, err := r.CalculateAllocationByType(ctx, portfolioID)
	if err != nil {
		return nil, err
	}

	var totalValue model.Money
	for _, alloc := range allocations {
		if alloc.TotalCostBasis != nil {
			totalValue += *alloc.TotalCostBasis
		}
	}

	return &AllocationBreakdown{
		PortfolioID:     portfolioID,
		TotalValue:      totalValue,
		Allocations:     allocations,
		CalculationDate: asOfDate,
	}, nil
}

// CalculateAllocationByType calculates allocation breakdown by asset type
func (r *PerformanceRepository) CalculateAllocationByType(ctx context.Context, portfolioID string) ([]AssetAllocation, error) {
	var allocations []struct {
		AssetType      model.AssetType `bun:"asset_type"`
		PositionCount  int             `bun:"position_count"`
		TotalQuantity  decimal.Decimal `bun:"total_quantity"`
		TotalCostBasis *int64          `bun:"total_cost_basis"`
		CurrentValue   int64           `bun:"current_value"`
	}

	err := r.db.NewSelect().
		ColumnExpr("a.type as asset_type").
		ColumnExpr("COUNT(*) as position_count").
		ColumnExpr("SUM(p.quantity) as total_quantity").
		ColumnExpr("SUM(p.total_cost_basis) as total_cost_basis").
		ColumnExpr("COALESCE(SUM(p.quantity * COALESCE(ap.price, 0) * p.ownership_percentage / 100), 0) * 100 as current_value").
		Model((*model.Position)(nil)).
		TableExpr("sigma_finance.positions p").
		Join("JOIN sigma_finance.assets a ON a.id = p.asset_id").
		Join("LEFT JOIN LATERAL (SELECT price FROM sigma_finance.asset_prices WHERE asset_id = a.id ORDER BY timestamp DESC LIMIT 1) ap ON true").
		Where("p.portfolio_id = ?", portfolioID).
		Group("a.type").
		Order("current_value DESC").
		Scan(ctx, &allocations)
	if err != nil {
		return nil, err
	}

	// Calculate total for percentage calculations
	var totalValue int64
	for _, alloc := range allocations {
		totalValue += alloc.CurrentValue
	}

	// Convert to result format
	result := make([]AssetAllocation, len(allocations))
	for i, alloc := range allocations {
		result[i] = AssetAllocation{
			AssetType:     alloc.AssetType,
			PositionCount: alloc.PositionCount,
			TotalQuantity: alloc.TotalQuantity,
		}

		if alloc.TotalCostBasis != nil {
			costBasis := model.Money(*alloc.TotalCostBasis)
			result[i].TotalCostBasis = &costBasis
		}

		// Calculate percentage based on current value
		if totalValue > 0 {
			percentage := decimal.NewFromInt(alloc.CurrentValue).
				Div(decimal.NewFromInt(totalValue)).
				Mul(decimal.NewFromInt(100))
			result[i].Percentage = percentage
		}
	}

	return result, nil
}

// CalculateAllocationBySector calculates allocation breakdown by sector (for stocks)
func (r *PerformanceRepository) CalculateAllocationBySector(ctx context.Context, portfolioID string) ([]AssetAllocation, error) {
	// This would require sector information in asset metadata
	// For now, return empty slice as this requires more complex metadata queries
	return []AssetAllocation{}, nil
}

// CalculateAllocationByGeography calculates allocation breakdown by geography
func (r *PerformanceRepository) CalculateAllocationByGeography(ctx context.Context, portfolioID string) ([]AssetAllocation, error) {
	// This would require geographic information in asset metadata
	// For now, return empty slice as this requires more complex metadata queries
	return []AssetAllocation{}, nil
}

// CreatePerformanceSnapshot creates a new performance snapshot
func (r *PerformanceRepository) CreatePerformanceSnapshot(ctx context.Context, snapshot *PerformanceSnapshot) error {
	_, err := r.db.NewInsert().
		Model(snapshot).
		TableExpr("sigma_finance.portfolio_performance").
		Exec(ctx)
	return err
}

// GetPerformanceSnapshots retrieves performance snapshots for a date range
func (r *PerformanceRepository) GetPerformanceSnapshots(ctx context.Context, portfolioID string, startDate, endDate time.Time) ([]PerformanceSnapshot, error) {
	var snapshots []PerformanceSnapshot
	err := r.db.NewSelect().
		Model(&snapshots).
		TableExpr("sigma_finance.portfolio_performance").
		Where("portfolio_id = ?", portfolioID).
		Where("snapshot_date >= ? AND snapshot_date <= ?", startDate, endDate).
		Order("snapshot_date ASC").
		Scan(ctx)

	return snapshots, err
}

// GetLatestPerformanceSnapshot retrieves the most recent performance snapshot
func (r *PerformanceRepository) GetLatestPerformanceSnapshot(ctx context.Context, portfolioID string) (*PerformanceSnapshot, error) {
	var snapshot PerformanceSnapshot
	err := r.db.NewSelect().
		Model(&snapshot).
		TableExpr("sigma_finance.portfolio_performance").
		Where("portfolio_id = ?", portfolioID).
		Order("snapshot_date DESC").
		Limit(1).
		Scan(ctx)
	if err != nil {
		return nil, err
	}

	return &snapshot, nil
}

// UpdatePerformanceSnapshots updates performance snapshots for multiple portfolios
func (r *PerformanceRepository) UpdatePerformanceSnapshots(ctx context.Context, portfolioIDs []string, asOfDate time.Time) error {
	for _, portfolioID := range portfolioIDs {
		metrics, err := r.CalculatePortfolioPerformance(ctx, portfolioID, asOfDate)
		if err != nil {
			continue // Skip portfolios with calculation errors
		}

		snapshot := &PerformanceSnapshot{
			PortfolioID:        portfolioID,
			TotalValue:         metrics.TotalValue,
			TotalCostBasis:     metrics.TotalCostBasis,
			UnrealizedGainLoss: metrics.UnrealizedGainLoss,
			RealizedGainLoss:   metrics.RealizedGainLoss,
			ReturnPercentage:   metrics.TotalReturnPercentage,
			SnapshotDate:       asOfDate,
			CreatedAt:          time.Now(),
		}

		// Upsert the snapshot
		_, err = r.db.NewInsert().
			Model(snapshot).
			TableExpr("sigma_finance.portfolio_performance").
			On("CONFLICT (portfolio_id, snapshot_date) DO UPDATE").
			Set("total_value = EXCLUDED.total_value").
			Set("total_cost_basis = EXCLUDED.total_cost_basis").
			Set("unrealized_gain_loss = EXCLUDED.unrealized_gain_loss").
			Set("realized_gain_loss = EXCLUDED.realized_gain_loss").
			Set("return_percentage = EXCLUDED.return_percentage").
			Set("created_at = EXCLUDED.created_at").
			Exec(ctx)
		if err != nil {
			return err
		}
	}

	return nil
}

// ComparePortfolioPerformance compares performance across multiple portfolios
func (r *PerformanceRepository) ComparePortfolioPerformance(ctx context.Context, portfolioIDs []string, startDate, endDate time.Time) (map[string]*PerformanceMetrics, error) {
	result := make(map[string]*PerformanceMetrics)

	for _, portfolioID := range portfolioIDs {
		metrics, err := r.CalculatePortfolioPerformance(ctx, portfolioID, endDate)
		if err != nil {
			continue // Skip portfolios with calculation errors
		}
		result[portfolioID] = metrics
	}

	return result, nil
}

// GetTopPerformingAssets retrieves the best performing assets in a portfolio
func (r *PerformanceRepository) GetTopPerformingAssets(ctx context.Context, portfolioID string, limit int, timeRange TimeRange) ([]PositionPerformanceResult, error) {
	var results []PositionPerformanceResult
	err := r.db.NewSelect().
		ColumnExpr("p.id as position_id").
		ColumnExpr("p.asset_id").
		ColumnExpr("a.name as asset_name").
		ColumnExpr("a.symbol as asset_symbol").
		ColumnExpr("a.type as asset_type").
		ColumnExpr("p.quantity").
		ColumnExpr("p.average_cost_basis").
		ColumnExpr("p.total_cost_basis").
		ColumnExpr("COALESCE(ap_current.price, 0) as current_price").
		ColumnExpr("CASE WHEN COALESCE(p.average_cost_basis, 0) > 0 THEN (COALESCE(ap_current.price, 0) - p.average_cost_basis) / p.average_cost_basis * 100 WHEN COALESCE(ap_start.price, 0) > 0 THEN (COALESCE(ap_current.price, 0) - ap_start.price) / ap_start.price * 100 ELSE 0 END as return_percentage").
		ColumnExpr("CAST(COALESCE(p.quantity, 0) * COALESCE(ap_current.price, 0) * COALESCE(p.ownership_percentage, 100) / 100 * 100 - COALESCE(p.total_cost_basis, 0) AS BIGINT) as gain_loss").
		ColumnExpr("0 as contribution").
		Model((*model.Position)(nil)).
		TableExpr("sigma_finance.positions p").
		Join("JOIN sigma_finance.assets a ON a.id = p.asset_id").
		Join("LEFT JOIN LATERAL (SELECT price FROM sigma_finance.asset_prices WHERE asset_id = p.asset_id AND timestamp <= ? ORDER BY timestamp DESC LIMIT 1) ap_current ON true", timeRange.End).
		Join("LEFT JOIN LATERAL (SELECT price FROM sigma_finance.asset_prices WHERE asset_id = p.asset_id AND timestamp <= ? ORDER BY timestamp DESC LIMIT 1) ap_start ON true", timeRange.Start).
		Where("p.portfolio_id = ?", portfolioID).
		Where("p.quantity > 0").
		Order("return_percentage DESC").
		Limit(limit).
		Scan(ctx)

	return results, err
}

// GetWorstPerformingAssets retrieves the worst performing assets in a portfolio
func (r *PerformanceRepository) GetWorstPerformingAssets(ctx context.Context, portfolioID string, limit int, timeRange TimeRange) ([]PositionPerformanceResult, error) {
	var results []PositionPerformanceResult
	err := r.db.NewSelect().
		ColumnExpr("p.id as position_id").
		ColumnExpr("p.asset_id").
		ColumnExpr("a.name as asset_name").
		ColumnExpr("a.symbol as asset_symbol").
		ColumnExpr("a.type as asset_type").
		ColumnExpr("p.quantity").
		ColumnExpr("p.average_cost_basis").
		ColumnExpr("p.total_cost_basis").
		ColumnExpr("COALESCE(ap_current.price, 0) as current_price").
		ColumnExpr("CASE WHEN COALESCE(p.average_cost_basis, 0) > 0 THEN (COALESCE(ap_current.price, 0) - p.average_cost_basis) / p.average_cost_basis * 100 WHEN COALESCE(ap_start.price, 0) > 0 THEN (COALESCE(ap_current.price, 0) - ap_start.price) / ap_start.price * 100 ELSE 0 END as return_percentage").
		ColumnExpr("CAST(COALESCE(p.quantity, 0) * COALESCE(ap_current.price, 0) * COALESCE(p.ownership_percentage, 100) / 100 * 100 - COALESCE(p.total_cost_basis, 0) AS BIGINT) as gain_loss").
		ColumnExpr("0 as contribution").
		Model((*model.Position)(nil)).
		TableExpr("sigma_finance.positions p").
		Join("JOIN sigma_finance.assets a ON a.id = p.asset_id").
		Join("LEFT JOIN LATERAL (SELECT price FROM sigma_finance.asset_prices WHERE asset_id = p.asset_id AND timestamp <= ? ORDER BY timestamp DESC LIMIT 1) ap_current ON true", timeRange.End).
		Join("LEFT JOIN LATERAL (SELECT price FROM sigma_finance.asset_prices WHERE asset_id = p.asset_id AND timestamp <= ? ORDER BY timestamp DESC LIMIT 1) ap_start ON true", timeRange.Start).
		Where("p.portfolio_id = ?", portfolioID).
		Where("p.quantity > 0").
		Order("return_percentage ASC").
		Limit(limit).
		Scan(ctx)

	return results, err
}

// CalculateBenchmarkComparison compares portfolio performance against a benchmark
func (r *PerformanceRepository) CalculateBenchmarkComparison(ctx context.Context, portfolioID string, benchmarkAssetID string, timeRange TimeRange) (*BenchmarkComparison, error) {
	// Get portfolio performance snapshots
	portfolioSnapshots, err := r.GetPerformanceSnapshots(ctx, portfolioID, timeRange.Start, timeRange.End)
	if err != nil || len(portfolioSnapshots) < 2 {
		return nil, err
	}

	// Get benchmark price history
	benchmarkPrices, err := NewPriceRepository(r.db).GetPriceHistory(ctx, benchmarkAssetID, timeRange)
	if err != nil || len(benchmarkPrices) < 2 {
		return nil, err
	}

	// Calculate portfolio return
	startValue := portfolioSnapshots[0].TotalValue
	endValue := portfolioSnapshots[len(portfolioSnapshots)-1].TotalValue
	var portfolioReturn decimal.Decimal
	if startValue > 0 {
		portfolioReturn = decimal.NewFromInt(int64(endValue - startValue)).
			Div(decimal.NewFromInt(int64(startValue))).
			Mul(decimal.NewFromInt(100))
	}

	// Calculate benchmark return
	startPrice := benchmarkPrices[0].Price
	endPrice := benchmarkPrices[len(benchmarkPrices)-1].Price
	benchmarkReturn := endPrice.Sub(startPrice).Div(startPrice).Mul(decimal.NewFromInt(100))

	// Calculate alpha (excess return over benchmark)
	alpha := portfolioReturn.Sub(benchmarkReturn)

	// For now, set beta to 1.0 (would require more sophisticated calculation)
	beta := decimal.NewFromInt(1)

	return &BenchmarkComparison{
		PortfolioID:      portfolioID,
		BenchmarkAssetID: benchmarkAssetID,
		PortfolioReturn:  portfolioReturn,
		BenchmarkReturn:  benchmarkReturn,
		Alpha:            alpha,
		Beta:             beta,
		TrackingError:    decimal.Zero, // Would require more data
		InformationRatio: decimal.Zero, // Would require more data
		CorrelationCoeff: decimal.Zero, // Would require more data
		StartDate:        timeRange.Start,
		EndDate:          timeRange.End,
	}, nil
}

// CalculateAndSaveHistoricalSnapshots calculates daily performance snapshots using a bulk vectorized SQL query.
// This is significantly faster than calculating day-by-day in Go.
func (r *PerformanceRepository) CalculateAndSaveHistoricalSnapshots(ctx context.Context, portfolioID string, startDate, endDate time.Time) error {
	query := `
WITH date_series AS (
    SELECT generate_series(?::date, ?::date, '1 day'::interval) AS snapshot_date
),
daily_metrics AS (
    SELECT 
        ds.snapshot_date,
        COALESCE(SUM(p.quantity * COALESCE(ap.price, 0) * p.ownership_percentage / 100), 0) * 100 AS total_value,
        COALESCE(SUM(p.total_cost_basis), 0) AS total_cost_basis,
        (COALESCE(SUM(p.quantity * COALESCE(ap.price, 0) * p.ownership_percentage / 100), 0) * 100) - COALESCE(SUM(p.total_cost_basis), 0) AS unrealized_gain_loss
    FROM date_series ds
    CROSS JOIN sigma_finance.positions p
    LEFT JOIN sigma_finance.assets a ON a.id = p.asset_id
    LEFT JOIN LATERAL (
        SELECT price 
        FROM sigma_finance.asset_prices 
        WHERE asset_id = a.id AND timestamp <= ds.snapshot_date + interval '23 hours 59 minutes 59 seconds'
        ORDER BY timestamp DESC 
        LIMIT 1
    ) ap ON true
    WHERE p.portfolio_id = ?
    GROUP BY ds.snapshot_date
),
realized_gains AS (
    SELECT 
        ds.snapshot_date,
        COALESCE(SUM(t.amount), 0) AS realized_gain_loss
    FROM date_series ds
    LEFT JOIN sigma_finance.positions p ON p.portfolio_id = ?
    LEFT JOIN sigma_finance.transactions t ON t.position_id = p.id AND t.type = 'SELL' AND t.executed_at <= ds.snapshot_date + interval '23 hours 59 minutes 59 seconds'
    GROUP BY ds.snapshot_date
)
INSERT INTO sigma_finance.portfolio_performance (
    portfolio_id, snapshot_date, total_value, total_cost_basis, unrealized_gain_loss, realized_gain_loss, return_percentage, created_at
)
SELECT 
    ?, 
    dm.snapshot_date, 
    dm.total_value, 
    dm.total_cost_basis, 
    dm.unrealized_gain_loss, 
    rg.realized_gain_loss,
    CASE 
        WHEN dm.total_cost_basis > 0 THEN 
            ((dm.total_value - dm.total_cost_basis + rg.realized_gain_loss) / dm.total_cost_basis::numeric) * 100
        ELSE 0 
    END AS return_percentage,
    NOW()
FROM daily_metrics dm
JOIN realized_gains rg ON dm.snapshot_date = rg.snapshot_date
ON CONFLICT (portfolio_id, snapshot_date) DO UPDATE SET
    total_value = EXCLUDED.total_value,
    total_cost_basis = EXCLUDED.total_cost_basis,
    unrealized_gain_loss = EXCLUDED.unrealized_gain_loss,
    realized_gain_loss = EXCLUDED.realized_gain_loss,
    return_percentage = EXCLUDED.return_percentage,
    created_at = EXCLUDED.created_at;
`
	_, err := r.db.ExecContext(ctx, query, startDate, endDate, portfolioID, portfolioID, portfolioID)
	return err
}
