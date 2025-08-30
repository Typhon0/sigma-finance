package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

// PerformanceMetrics represents calculated performance metrics
type PerformanceMetrics struct {
	PortfolioID           uuid.UUID       `json:"portfolio_id"`
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
	PortfolioID     uuid.UUID         `json:"portfolio_id"`
	TotalValue      model.Money       `json:"total_value"`
	Allocations     []AssetAllocation `json:"allocations"`
	CalculationDate time.Time         `json:"calculation_date"`
}

// PerformanceSnapshot represents a daily performance snapshot
type PerformanceSnapshot struct {
	ID                 int64           `json:"id"`
	PortfolioID        uuid.UUID       `json:"portfolio_id"`
	TotalValue         model.Money     `json:"total_value"`
	TotalCostBasis     model.Money     `json:"total_cost_basis"`
	UnrealizedGainLoss model.Money     `json:"unrealized_gain_loss"`
	RealizedGainLoss   model.Money     `json:"realized_gain_loss"`
	ReturnPercentage   decimal.Decimal `json:"return_percentage"`
	SnapshotDate       time.Time       `json:"snapshot_date"`
	CreatedAt          time.Time       `json:"created_at"`
}

// IPerformanceRepository defines the interface for performance calculation operations
type IPerformanceRepository interface {
	// Performance calculations
	CalculatePortfolioPerformance(ctx context.Context, portfolioID uuid.UUID, asOfDate time.Time) (*PerformanceMetrics, error)
	CalculateTimeWeightedReturn(ctx context.Context, portfolioID uuid.UUID, startDate, endDate time.Time) (decimal.Decimal, error)
	CalculateVolatility(ctx context.Context, portfolioID uuid.UUID, days int) (decimal.Decimal, error)
	CalculateMaxDrawdown(ctx context.Context, portfolioID uuid.UUID, startDate, endDate time.Time) (decimal.Decimal, error)

	// Allocation calculations
	CalculateAssetAllocation(ctx context.Context, portfolioID uuid.UUID, asOfDate time.Time) (*AllocationBreakdown, error)
	CalculateAllocationByType(ctx context.Context, portfolioID uuid.UUID) ([]AssetAllocation, error)
	CalculateAllocationBySector(ctx context.Context, portfolioID uuid.UUID) ([]AssetAllocation, error)
	CalculateAllocationByGeography(ctx context.Context, portfolioID uuid.UUID) ([]AssetAllocation, error)

	// Performance snapshots
	CreatePerformanceSnapshot(ctx context.Context, snapshot *PerformanceSnapshot) error
	GetPerformanceSnapshots(ctx context.Context, portfolioID uuid.UUID, startDate, endDate time.Time) ([]PerformanceSnapshot, error)
	GetLatestPerformanceSnapshot(ctx context.Context, portfolioID uuid.UUID) (*PerformanceSnapshot, error)
	UpdatePerformanceSnapshots(ctx context.Context, portfolioIDs []uuid.UUID, asOfDate time.Time) error

	// Comparative analysis
	ComparePortfolioPerformance(ctx context.Context, portfolioIDs []uuid.UUID, startDate, endDate time.Time) (map[uuid.UUID]*PerformanceMetrics, error)
	GetTopPerformingAssets(ctx context.Context, portfolioID uuid.UUID, limit int, timeRange TimeRange) ([]model.Position, error)
	GetWorstPerformingAssets(ctx context.Context, portfolioID uuid.UUID, limit int, timeRange TimeRange) ([]model.Position, error)

	// Benchmark comparison
	CalculateBenchmarkComparison(ctx context.Context, portfolioID uuid.UUID, benchmarkAssetID uuid.UUID, timeRange TimeRange) (*BenchmarkComparison, error)
}

// BenchmarkComparison represents performance comparison against a benchmark
type BenchmarkComparison struct {
	PortfolioID      uuid.UUID       `json:"portfolio_id"`
	BenchmarkAssetID uuid.UUID       `json:"benchmark_asset_id"`
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
func (r *PerformanceRepository) CalculatePortfolioPerformance(ctx context.Context, portfolioID uuid.UUID, asOfDate time.Time) (*PerformanceMetrics, error) {
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
		Where("t.transaction_date <= ?", asOfDate).
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
func (r *PerformanceRepository) CalculateTimeWeightedReturn(ctx context.Context, portfolioID uuid.UUID, startDate, endDate time.Time) (decimal.Decimal, error) {
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
func (r *PerformanceRepository) CalculateVolatility(ctx context.Context, portfolioID uuid.UUID, days int) (decimal.Decimal, error) {
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
func (r *PerformanceRepository) CalculateMaxDrawdown(ctx context.Context, portfolioID uuid.UUID, startDate, endDate time.Time) (decimal.Decimal, error) {
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
func (r *PerformanceRepository) CalculateAssetAllocation(ctx context.Context, portfolioID uuid.UUID, asOfDate time.Time) (*AllocationBreakdown, error) {
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
func (r *PerformanceRepository) CalculateAllocationByType(ctx context.Context, portfolioID uuid.UUID) ([]AssetAllocation, error) {
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
func (r *PerformanceRepository) CalculateAllocationBySector(ctx context.Context, portfolioID uuid.UUID) ([]AssetAllocation, error) {
	// This would require sector information in asset metadata
	// For now, return empty slice as this requires more complex metadata queries
	return []AssetAllocation{}, nil
}

// CalculateAllocationByGeography calculates allocation breakdown by geography
func (r *PerformanceRepository) CalculateAllocationByGeography(ctx context.Context, portfolioID uuid.UUID) ([]AssetAllocation, error) {
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
func (r *PerformanceRepository) GetPerformanceSnapshots(ctx context.Context, portfolioID uuid.UUID, startDate, endDate time.Time) ([]PerformanceSnapshot, error) {
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
func (r *PerformanceRepository) GetLatestPerformanceSnapshot(ctx context.Context, portfolioID uuid.UUID) (*PerformanceSnapshot, error) {
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
func (r *PerformanceRepository) UpdatePerformanceSnapshots(ctx context.Context, portfolioIDs []uuid.UUID, asOfDate time.Time) error {
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
func (r *PerformanceRepository) ComparePortfolioPerformance(ctx context.Context, portfolioIDs []uuid.UUID, startDate, endDate time.Time) (map[uuid.UUID]*PerformanceMetrics, error) {
	result := make(map[uuid.UUID]*PerformanceMetrics)

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
func (r *PerformanceRepository) GetTopPerformingAssets(ctx context.Context, portfolioID uuid.UUID, limit int, timeRange TimeRange) ([]model.Position, error) {
	var positions []model.Position
	err := r.db.NewSelect().
		Model(&positions).
		Relation("Asset").
		ColumnExpr("position.*").
		ColumnExpr("(COALESCE(ap_current.price, 0) - COALESCE(ap_start.price, 0)) / NULLIF(COALESCE(ap_start.price, 0), 0) * 100 as performance").
		Join("LEFT JOIN LATERAL (SELECT price FROM sigma_finance.asset_prices WHERE asset_id = position.asset_id AND timestamp <= ? ORDER BY timestamp DESC LIMIT 1) ap_current ON true", timeRange.End).
		Join("LEFT JOIN LATERAL (SELECT price FROM sigma_finance.asset_prices WHERE asset_id = position.asset_id AND timestamp <= ? ORDER BY timestamp DESC LIMIT 1) ap_start ON true", timeRange.Start).
		Where("position.portfolio_id = ?", portfolioID).
		Where("position.quantity > 0").
		Order("performance DESC").
		Limit(limit).
		Scan(ctx)

	return positions, err
}

// GetWorstPerformingAssets retrieves the worst performing assets in a portfolio
func (r *PerformanceRepository) GetWorstPerformingAssets(ctx context.Context, portfolioID uuid.UUID, limit int, timeRange TimeRange) ([]model.Position, error) {
	var positions []model.Position
	err := r.db.NewSelect().
		Model(&positions).
		Relation("Asset").
		ColumnExpr("position.*").
		ColumnExpr("(COALESCE(ap_current.price, 0) - COALESCE(ap_start.price, 0)) / NULLIF(COALESCE(ap_start.price, 0), 0) * 100 as performance").
		Join("LEFT JOIN LATERAL (SELECT price FROM sigma_finance.asset_prices WHERE asset_id = position.asset_id AND timestamp <= ? ORDER BY timestamp DESC LIMIT 1) ap_current ON true", timeRange.End).
		Join("LEFT JOIN LATERAL (SELECT price FROM sigma_finance.asset_prices WHERE asset_id = position.asset_id AND timestamp <= ? ORDER BY timestamp DESC LIMIT 1) ap_start ON true", timeRange.Start).
		Where("position.portfolio_id = ?", portfolioID).
		Where("position.quantity > 0").
		Order("performance ASC").
		Limit(limit).
		Scan(ctx)

	return positions, err
}

// CalculateBenchmarkComparison compares portfolio performance against a benchmark
func (r *PerformanceRepository) CalculateBenchmarkComparison(ctx context.Context, portfolioID uuid.UUID, benchmarkAssetID uuid.UUID, timeRange TimeRange) (*BenchmarkComparison, error) {
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
