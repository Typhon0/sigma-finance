package repository

import (
	"context"
	"log"
	"runtime"
	"sigma_finance/internal/benchmark"
	"sigma_finance/internal/domain/model"
	"strconv"
	"strings"
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
	bun.BaseModel `bun:"table:sigma_finance.portfolio_performance"`

	ID                 int64           `json:"id" bun:"id,pk,autoincrement"`
	PortfolioID        string          `json:"portfolio_id" bun:"portfolio_id,type:uuid,notnull"`
	TotalValue         model.Money     `json:"total_value" bun:"total_value,notnull"`
	TotalCostBasis     model.Money     `json:"total_cost_basis" bun:"total_cost_basis,notnull"`
	UnrealizedGainLoss model.Money     `json:"unrealized_gain_loss" bun:"unrealized_gain_loss,notnull"`
	RealizedGainLoss   model.Money     `json:"realized_gain_loss" bun:"realized_gain_loss,notnull"`
	ReturnPercentage   decimal.Decimal `json:"return_percentage" bun:"return_percentage,type:numeric(10,4)"`
	SnapshotDate       time.Time       `json:"snapshot_date" bun:"snapshot_date,notnull"`
	CreatedAt          time.Time       `json:"created_at" bun:"created_at,nullzero,notnull,default:current_timestamp"`
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
	CalculateSharpeRatio(ctx context.Context, portfolioID string, riskFreeRate decimal.Decimal, days int) (decimal.Decimal, error)
	CalculateSortinoRatio(ctx context.Context, portfolioID string, riskFreeRate decimal.Decimal, days int) (decimal.Decimal, error)

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
		ColumnExpr(`COALESCE(SUM(
			p.quantity * COALESCE(ap.price, 0) * (p.ownership_percentage / 100) *
			CASE
				WHEN COALESCE(NULLIF(p.quote_currency, ''), 'USD') = 'USD' THEN 1.0
				WHEN fx_direct.rate IS NOT NULL THEN fx_direct.rate
				WHEN fx_inverse.rate IS NOT NULL AND fx_inverse.rate > 0 THEN 1.0 / fx_inverse.rate
				ELSE 1.0
			END
		), 0) * 100 as total_value`).
		ColumnExpr(`COALESCE(SUM(
			COALESCE(p.total_cost_basis, 0) *
			CASE
				WHEN COALESCE(NULLIF(p.quote_currency, ''), 'USD') = 'USD' THEN 1.0
				WHEN fx_direct.rate IS NOT NULL THEN fx_direct.rate
				WHEN fx_inverse.rate IS NOT NULL AND fx_inverse.rate > 0 THEN 1.0 / fx_inverse.rate
				ELSE 1.0
			END
		), 0) as total_cost_basis`).
		ColumnExpr(`COALESCE(SUM(
			(p.quantity * COALESCE(ap.price, 0) * (p.ownership_percentage / 100) * 100 - COALESCE(p.total_cost_basis, 0)) *
			CASE
				WHEN COALESCE(NULLIF(p.quote_currency, ''), 'USD') = 'USD' THEN 1.0
				WHEN fx_direct.rate IS NOT NULL THEN fx_direct.rate
				WHEN fx_inverse.rate IS NOT NULL AND fx_inverse.rate > 0 THEN 1.0 / fx_inverse.rate
				ELSE 1.0
			END
		), 0) as unrealized_gain_loss`).
		Model((*model.Position)(nil)).
		TableExpr("sigma_finance.positions p").
		Join("LEFT JOIN sigma_finance.assets a ON a.id = p.asset_id").
		Join("LEFT JOIN LATERAL (SELECT price FROM sigma_finance.asset_prices WHERE asset_id = a.id AND timestamp <= ? ORDER BY timestamp DESC LIMIT 1) ap ON true", asOfDate).
		Join("LEFT JOIN LATERAL (SELECT rate FROM sigma_finance.fx_rates WHERE base_currency = COALESCE(NULLIF(p.quote_currency, ''), 'USD') AND quote_currency = 'USD' AND as_of <= ? ORDER BY as_of DESC LIMIT 1) fx_direct ON true", asOfDate).
		Join("LEFT JOIN LATERAL (SELECT rate FROM sigma_finance.fx_rates WHERE base_currency = 'USD' AND quote_currency = COALESCE(NULLIF(p.quote_currency, ''), 'USD') AND as_of <= ? ORDER BY as_of DESC LIMIT 1) fx_inverse ON true", asOfDate).
		Where("p.portfolio_id = ?", portfolioID).
		Scan(ctx, &portfolioData)
	if err != nil {
		return nil, err
	}

	// Get realized gains from transactions: Net Gain = Gross Proceeds - Cost Basis - Fees (converted to portfolio base currency)
	var realizedGains int64
	err = r.db.NewSelect().
		ColumnExpr(`COALESCE(SUM(
			(ABS(t.amount) - (t.quantity * COALESCE(p.average_cost_basis, 0) * 100) - COALESCE(t.fees_amount, 0)) *
			CASE
				WHEN COALESCE(NULLIF(t.unit_price_currency, ''), 'USD') = 'USD' THEN 1.0
				WHEN fx_direct.rate IS NOT NULL THEN fx_direct.rate
				WHEN fx_inverse.rate IS NOT NULL AND fx_inverse.rate > 0 THEN 1.0 / fx_inverse.rate
				ELSE 1.0
			END
		), 0)`).
		Model((*model.Transaction)(nil)).
		TableExpr("sigma_finance.transactions t").
		Join("JOIN sigma_finance.positions p ON p.id = t.position_id").
		Join("LEFT JOIN LATERAL (SELECT rate FROM sigma_finance.fx_rates WHERE base_currency = COALESCE(NULLIF(t.unit_price_currency, ''), 'USD') AND quote_currency = 'USD' AND as_of <= ? ORDER BY as_of DESC LIMIT 1) fx_direct ON true", asOfDate).
		Join("LEFT JOIN LATERAL (SELECT rate FROM sigma_finance.fx_rates WHERE base_currency = 'USD' AND quote_currency = COALESCE(NULLIF(t.unit_price_currency, ''), 'USD') AND as_of <= ? ORDER BY as_of DESC LIMIT 1) fx_inverse ON true", asOfDate).
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

// decimalSqrt returns the square root of a non-negative decimal using Newton's
// method, matching the precision convention used by CalculateVolatility.
func decimalSqrt(v decimal.Decimal) decimal.Decimal {
	if !v.GreaterThan(decimal.Zero) {
		return decimal.Zero
	}
	x := v.Div(decimal.NewFromInt(2))
	for i := 0; i < 20; i++ {
		if x.IsZero() {
			break
		}
		x = x.Add(v.Div(x)).Div(decimal.NewFromInt(2))
	}
	return x
}

// dailyReturns derives the period-over-period returns from performance
// snapshots. A snapshot with a zero predecessor contributes no return, so a
// newly-created portfolio does not produce a -100% artefact.
func (r *PerformanceRepository) dailyReturns(ctx context.Context, portfolioID string, days int) ([]decimal.Decimal, error) {
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -days)

	snapshots, err := r.GetPerformanceSnapshots(ctx, portfolioID, startDate, endDate)
	if err != nil {
		return nil, err
	}

	var returns []decimal.Decimal
	for i := 1; i < len(snapshots); i++ {
		prev := snapshots[i-1].TotalValue
		curr := snapshots[i].TotalValue

		if prev > 0 {
			returns = append(returns,
				decimal.NewFromInt(int64(curr)).
					Div(decimal.NewFromInt(int64(prev))).
					Sub(decimal.NewFromInt(1)),
			)
		}
	}
	return returns, nil
}

// tradingDaysPerYear is the annualization factor for daily-return ratios.
var tradingDaysPerYear = decimal.NewFromInt(252)

// degenerateDispersion is the dispersion below which a return series is treated
// as having no measurable variation, and the risk ratio is reported as unknown.
//
// A guard on "> 0" alone is not enough, and the failure mode it misses is worse
// than returning nothing. Dividing mean return by a near-zero dispersion is
// numerically unstable: a portfolio creeping up 1% a day - where compounding
// makes 10303/10201 differ from 1.01 only in the sixth decimal - has a
// standard deviation around 1e-6, and the resulting "Sharpe ratio" comes out in
// the tens of thousands. That is a far more confident-looking and far more wrong
// answer than the hardcoded zero it replaced.
//
// The floor is 1e-4 of daily dispersion (0.01%). Measured against real inputs,
// a creeping 1%-a-day series sits around 1.4e-6 while a genuinely volatile
// portfolio sits around 3e-2 - so this threshold rejects the numerical dust
// while staying ~300x below the lowest dispersion worth reporting and ~1000x
// below the daily volatility of a typical equity portfolio.
var degenerateDispersion = decimal.New(1, -4)

func isDegenerate(dispersion decimal.Decimal) bool {
	return !dispersion.GreaterThan(degenerateDispersion)
}

// dailyRiskFree converts an annual percentage risk-free rate into a daily
// decimal rate. A zero or negative rate is treated as no risk-free return.
func dailyRiskFree(riskFreeRate decimal.Decimal) decimal.Decimal {
	if !riskFreeRate.GreaterThan(decimal.Zero) {
		return decimal.Zero
	}
	return riskFreeRate.Div(decimal.NewFromInt(100)).Div(tradingDaysPerYear)
}

// sharpeFromReturns computes the annualized Sharpe ratio from a daily return
// series:
//
//	Sharpe = (meanDailyReturn - riskFreeDaily) / stdev(dailyReturn) * sqrt(252)
//
// A flat series has zero standard deviation, so the ratio is undefined; this
// returns zero rather than dividing by zero. Fewer than two observations is
// likewise not enough to measure, and returns zero.
func sharpeFromReturns(returns []decimal.Decimal, riskFreeRate decimal.Decimal) decimal.Decimal {
	if len(returns) < 2 {
		return decimal.Zero
	}

	var sum decimal.Decimal
	for _, ret := range returns {
		sum = sum.Add(ret)
	}
	mean := sum.Div(decimal.NewFromInt(int64(len(returns))))

	var varianceSum decimal.Decimal
	for _, ret := range returns {
		diff := ret.Sub(mean)
		varianceSum = varianceSum.Add(diff.Mul(diff))
	}
	variance := varianceSum.Div(decimal.NewFromInt(int64(len(returns) - 1)))
	stdDev := decimalSqrt(variance)
	if isDegenerate(stdDev) {
		return decimal.Zero
	}

	excess := mean.Sub(dailyRiskFree(riskFreeRate))
	return excess.Div(stdDev).Mul(decimalSqrt(tradingDaysPerYear))
}

// sortinoFromReturns computes the annualized Sortino ratio, which like Sharpe
// annualizes daily returns but penalizes only downside deviation:
//
//	Sortino = (meanDailyReturn - riskFreeDaily) / downsideDeviation * sqrt(252)
//
// Downside deviation is measured about the daily risk-free target, so upside
// swings contribute nothing to the denominator.
func sortinoFromReturns(returns []decimal.Decimal, riskFreeRate decimal.Decimal) decimal.Decimal {
	if len(returns) < 2 {
		return decimal.Zero
	}

	var sum decimal.Decimal
	for _, ret := range returns {
		sum = sum.Add(ret)
	}
	mean := sum.Div(decimal.NewFromInt(int64(len(returns))))

	target := dailyRiskFree(riskFreeRate)

	var downsideSum decimal.Decimal
	for _, ret := range returns {
		diff := ret.Sub(target)
		if diff.IsNegative() {
			downsideSum = downsideSum.Add(diff.Mul(diff))
		}
	}
	downsideDeviation := decimalSqrt(downsideSum.Div(decimal.NewFromInt(int64(len(returns)))))
	if isDegenerate(downsideDeviation) {
		return decimal.Zero
	}

	excess := mean.Sub(target)
	return excess.Div(downsideDeviation).Mul(decimalSqrt(tradingDaysPerYear))
}

// CalculateSharpeRatio computes the annualized Sharpe ratio for a portfolio
// from its performance snapshot history.
func (r *PerformanceRepository) CalculateSharpeRatio(ctx context.Context, portfolioID string, riskFreeRate decimal.Decimal, days int) (decimal.Decimal, error) {
	returns, err := r.dailyReturns(ctx, portfolioID, days)
	if err != nil {
		return decimal.Zero, err
	}
	return sharpeFromReturns(returns, riskFreeRate), nil
}

// CalculateSortinoRatio computes the annualized Sortino ratio for a portfolio
// from its performance snapshot history.
func (r *PerformanceRepository) CalculateSortinoRatio(ctx context.Context, portfolioID string, riskFreeRate decimal.Decimal, days int) (decimal.Decimal, error) {
	returns, err := r.dailyReturns(ctx, portfolioID, days)
	if err != nil {
		return decimal.Zero, err
	}
	return sortinoFromReturns(returns, riskFreeRate), nil
}

// CalculateVolatility calculates the volatility (standard deviation of returns) for a portfolio
func (r *PerformanceRepository) CalculateVolatility(ctx context.Context, portfolioID string, days int) (decimal.Decimal, error) {
	returns, err := r.dailyReturns(ctx, portfolioID, days)
	if err != nil {
		return decimal.Zero, err
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
		ColumnExpr(`COALESCE(SUM(
			COALESCE(p.total_cost_basis, 0) *
			CASE
				WHEN COALESCE(NULLIF(p.quote_currency, ''), 'USD') = 'USD' THEN 1.0
				WHEN fx_direct.rate IS NOT NULL THEN fx_direct.rate
				WHEN fx_inverse.rate IS NOT NULL AND fx_inverse.rate > 0 THEN 1.0 / fx_inverse.rate
				ELSE 1.0
			END
		), 0) as total_cost_basis`).
		ColumnExpr(`COALESCE(SUM(
			p.quantity * COALESCE(ap.price, 0) * (p.ownership_percentage / 100) *
			CASE
				WHEN COALESCE(NULLIF(p.quote_currency, ''), 'USD') = 'USD' THEN 1.0
				WHEN fx_direct.rate IS NOT NULL THEN fx_direct.rate
				WHEN fx_inverse.rate IS NOT NULL AND fx_inverse.rate > 0 THEN 1.0 / fx_inverse.rate
				ELSE 1.0
			END
		), 0) * 100 as current_value`).
		Model((*model.Position)(nil)).
		TableExpr("sigma_finance.positions p").
		Join("JOIN sigma_finance.assets a ON a.id = p.asset_id").
		Join("LEFT JOIN LATERAL (SELECT price FROM sigma_finance.asset_prices WHERE asset_id = a.id ORDER BY timestamp DESC LIMIT 1) ap ON true").
		Join("LEFT JOIN LATERAL (SELECT rate FROM sigma_finance.fx_rates WHERE base_currency = COALESCE(NULLIF(p.quote_currency, ''), 'USD') AND quote_currency = 'USD' ORDER BY as_of DESC LIMIT 1) fx_direct ON true").
		Join("LEFT JOIN LATERAL (SELECT rate FROM sigma_finance.fx_rates WHERE base_currency = 'USD' AND quote_currency = COALESCE(NULLIF(p.quote_currency, ''), 'USD') ORDER BY as_of DESC LIMIT 1) fx_inverse ON true").
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
		Exec(ctx)
	return err
}

// GetPerformanceSnapshots retrieves performance snapshots for a date range
func (r *PerformanceRepository) GetPerformanceSnapshots(ctx context.Context, portfolioID string, startDate, endDate time.Time) ([]PerformanceSnapshot, error) {
	var snapshots []PerformanceSnapshot
	err := r.db.NewSelect().
		Model(&snapshots).
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

// CalculateBenchmarkComparison compares portfolio performance against a benchmark.
// Returns real Beta / TrackingError / InformationRatio / Correlation derived
// from the aligned daily returns of portfolio snapshots and benchmark price
// history. Falls back to portfolioReturn/benchmarkReturn/alpha only when
// there are insufficient aligned points (n < 2) — the math helpers in
// service package return zero in that case.
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

	// Real Beta / TrackingError / InformationRatio / Correlation and TWR from
	// aligned daily returns. Snapshots and prices are floored to UTC
	// midnight, collapsed to one-sample-per-day (last-write-wins), and
	// joined via LOCF on the portfolio calendar. Robust against intraday
	// timestamps, sparse or duplicate-day observations, and uneven series
	// lengths between snapshots and price rows.
	portSamples := make([]benchmark.PortfolioSample, len(portfolioSnapshots))
	for i, snap := range portfolioSnapshots {
		portSamples[i] = benchmark.PortfolioSample{
			Timestamp: snap.SnapshotDate,
			Value:     snap.TotalValue,
			CostBasis: snap.TotalCostBasis,
		}
	}
	benchSamples := make([]benchmark.BenchmarkSample, len(benchmarkPrices))
	for i, p := range benchmarkPrices {
		benchSamples[i] = benchmark.BenchmarkSample{
			Timestamp: p.Timestamp,
			Price:     p.Price,
		}
	}
	portVals, priceVals := benchmark.AlignDaily(portSamples, benchSamples)

	var (
		portfolioReturn  decimal.Decimal
		benchmarkReturn  decimal.Decimal
		alpha            decimal.Decimal
		beta             = decimal.NewFromInt(1) // safe default for insufficient data
		trackingError    = decimal.Zero
		informationRatio = decimal.Zero
		correlationCoeff = decimal.Zero
	)
	if len(portVals) >= 2 && len(priceVals) >= 2 {
		alignedPortReturns := benchmark.DailyTWRReturns(portVals)
		alignedBenchReturns := benchmark.DailyPriceReturns(priceVals)
		if len(alignedPortReturns) >= 1 && len(alignedBenchReturns) >= 1 {
			portfolioReturn = benchmark.CompoundTWR(alignedPortReturns)
			benchmarkReturn = benchmark.CompoundTWR(alignedBenchReturns)
			alpha = portfolioReturn.Sub(benchmarkReturn)
			if len(alignedPortReturns) >= 2 && len(alignedBenchReturns) >= 2 {
				beta = benchmark.Beta(alignedPortReturns, alignedBenchReturns)
				trackingError = benchmark.TrackingError(alignedPortReturns, alignedBenchReturns)
				informationRatio = benchmark.InformationRatio(alignedPortReturns, alignedBenchReturns)
				correlationCoeff = benchmark.PearsonCorrelation(alignedPortReturns, alignedBenchReturns)
			}
		}
	}

	// Fallback to cumulative price change when daily alignment produced insufficient pairs
	if portfolioReturn.IsZero() && benchmarkReturn.IsZero() {
		startValue := portfolioSnapshots[0].TotalValue
		endValue := portfolioSnapshots[len(portfolioSnapshots)-1].TotalValue
		startCost := portfolioSnapshots[0].TotalCostBasis
		endCost := portfolioSnapshots[len(portfolioSnapshots)-1].TotalCostBasis
		deltaCost := endCost - startCost
		capitalBase := startValue
		if deltaCost > 0 {
			capitalBase += deltaCost
		}
		if capitalBase > 0 {
			netGain := (endValue - startValue) - deltaCost
			portfolioReturn = decimal.NewFromInt(int64(netGain)).
				Div(decimal.NewFromInt(int64(capitalBase))).
				Mul(decimal.NewFromInt(100))
		}
		startPrice := benchmarkPrices[0].Price
		endPrice := benchmarkPrices[len(benchmarkPrices)-1].Price
		if !startPrice.IsZero() {
			benchmarkReturn = endPrice.Sub(startPrice).Div(startPrice).Mul(decimal.NewFromInt(100))
		}
		alpha = portfolioReturn.Sub(benchmarkReturn)
	}

	return &BenchmarkComparison{
		PortfolioID:      portfolioID,
		BenchmarkAssetID: benchmarkAssetID,
		PortfolioReturn:  portfolioReturn,
		BenchmarkReturn:  benchmarkReturn,
		Alpha:            alpha,
		Beta:             beta,
		TrackingError:    trackingError,
		InformationRatio: informationRatio,
		CorrelationCoeff: correlationCoeff,
		StartDate:        timeRange.Start,
		EndDate:          timeRange.End,
	}, nil
}

// CalculateAndSaveHistoricalSnapshots calculates daily performance snapshots using a bulk vectorized SQL query.
// This is significantly faster than calculating day-by-day in Go.
//
// Position-aware reconstruction: for each (snapshot_date, position_id) row we
// compute quantity and cost basis using only what is actually true on that
// calendar day, recovered from the transactions table:
//
//   - For positions with at least one transaction: net quantity at snapshot_date
//     = SUM(quantity) for BUY/DEPOSIT/TRANSFER_IN minus SUM(quantity) for
//     SELL/WITHDRAWAL/TRANSFER_OUT, filtered by executed_at <= snapshot_date.
//     The signed-sum naturally produces 0 before the first BUY, eliminating the
//     "orphan" -100% bad seed rows that the old CROSS-JOIN-on-current-positions
//     SQL produced.
//
//   - For positions WITHOUT transactions (seeded positions like ABEA.F, MSFT,
//     NVDA): quantity = positions.quantity if snapshot_date >=
//     positions.created_at, else 0.  These are conceptually "you've always had
//     them, just at their current cost basis".
//
// Cost basis: 0 when quantity is 0 (you don't hold it, so it can't have cost),
// else positions.total_cost_basis as a static snapshot. Running AVCO would
// require a recursive CTE and is intentionally out-of-scope here — the cost
// basis at today's snapshot is what users see in the dashboard, so consistency
// with positions.total_cost_basis at snapshot_date >= first-buy is preferred
// over a half-baked in-flight AVCO for partially-sold positions.
//
// Realized gains: SUM(transactions.amount) where type='SELL' and executed_at <=
// snapshot_date.  SELL amounts are stored negative (the model validates this
// in validateAmountSign), so a realized P&L of +X shows up as a negative sum.
// This matches the existing convention in CalculatePortfolioPerformance so
// downstream callers see consistent numbers.
//
// Diagnostics: every invocation logs portfolio + range + caller function at
// INFO level so ad-hoc deletes followed by automatic rebuilds leave an audit
// trail. Ad-hoc operators who need to PURGE then rebuild should set
// DISABLE_AUTO_SNAPSHOT_REBUILD=true before the purge so the auto-rebuild path
// in generatePerformanceHistory skips its self-healing call.
func (r *PerformanceRepository) CalculateAndSaveHistoricalSnapshots(ctx context.Context, portfolioID string, startDate, endDate time.Time) error {
	logSnapshotRebuildCaller("CalculateAndSaveHistoricalSnapshots", portfolioID, startDate, endDate)
	query := `
WITH date_series AS (
    SELECT generate_series(?::date, ?::date, '1 day'::interval)::date AS snapshot_date
),
positions_with_tx AS (
    SELECT DISTINCT position_id
    FROM sigma_finance.transactions
    WHERE position_id IS NOT NULL
),
quantity_per_position_per_day AS (
    SELECT
        p.id AS position_id,
        p.asset_id,
        p.ownership_percentage,
        p.created_at,
        p.total_cost_basis AS current_total_cost_basis,
        ds.snapshot_date,
        CASE
            WHEN p.id IN (SELECT position_id FROM positions_with_tx) THEN
                COALESCE((
                    SELECT SUM(
                        CASE
                            WHEN t.type IN ('BUY','DEPOSIT','TRANSFER_IN') THEN  t.quantity
                            WHEN t.type IN ('SELL','WITHDRAWAL','TRANSFER_OUT') THEN -t.quantity
                            ELSE 0
                        END
                    )
                    FROM sigma_finance.transactions t
                    WHERE t.position_id = p.id
                      AND t.executed_at <= ds.snapshot_date + interval '23 hours 59 minutes 59 seconds'
                ), 0)
            WHEN ds.snapshot_date >= date_trunc('day', p.created_at)::date THEN p.quantity
            ELSE 0
        END AS quantity_at_date
    FROM sigma_finance.positions p
    CROSS JOIN date_series ds
    WHERE p.portfolio_id = ?
),
priced_metrics AS (
    SELECT
        qppd.snapshot_date,
        qppd.quantity_at_date,
        CASE WHEN qppd.quantity_at_date > 0
             THEN COALESCE(qppd.current_total_cost_basis, 0)
             ELSE 0
        END AS cost_basis_at_date,
        COALESCE(ap.price, 0) AS price_at_date,
        COALESCE(qppd.ownership_percentage, 100) AS ownership_pct
    FROM quantity_per_position_per_day qppd
    LEFT JOIN LATERAL (
        SELECT price
        FROM sigma_finance.asset_prices
        WHERE asset_id = qppd.asset_id
          AND timestamp <= qppd.snapshot_date + interval '23 hours 59 minutes 59 seconds'
        ORDER BY timestamp DESC
        LIMIT 1
    ) ap ON true
),
daily_metrics AS (
    SELECT
        pm.snapshot_date,
        SUM(pm.quantity_at_date * pm.price_at_date * pm.ownership_pct / 100) * 100 AS total_value,
        SUM(pm.cost_basis_at_date) AS total_cost_basis,
        SUM(pm.quantity_at_date * pm.price_at_date * pm.ownership_pct / 100) * 100
            - SUM(pm.cost_basis_at_date) AS unrealized_gain_loss
    FROM priced_metrics pm
    GROUP BY pm.snapshot_date
),
realized_gains AS (
    SELECT
        ds.snapshot_date,
        COALESCE(SUM(ABS(t.amount) - (t.quantity * COALESCE(p.average_cost_basis, 0) * 100) - COALESCE(t.fees_amount, 0)), 0) AS realized_gain_loss
    FROM date_series ds
    LEFT JOIN sigma_finance.positions p ON p.portfolio_id = ?
    LEFT JOIN sigma_finance.transactions t
        ON t.position_id = p.id
        AND t.type = 'SELL'
        AND t.executed_at <= ds.snapshot_date + interval '23 hours 59 minutes 59 seconds'
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
JOIN realized_gains rg USING (snapshot_date)
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

// logSnapshotRebuildCaller emits a single INFO line at the entry of any
// snapshot-rebuild path so ad-hoc operators can grep for unexpected rebuilds
// after the fact. The caller is resolved via runtime.Caller(2) which lands in
// the actual caller of CalculateAndSaveHistoricalSnapshots - typically
// generatePerformanceHistory (auto-heal) or tools/rebuild_portfolio_snapshots
// (ad-hoc tooling).
//
// Set DISABLE_AUTO_SNAPSHOT_REBUILD=true in the server process before
// performing a manual PURGE so that the auto-rebuild path inside
// generatePerformanceHistory short-circuits and lets the manual rebuild be
// the source of truth.
func logSnapshotRebuildCaller(selfName, portfolioID string, startDate, endDate time.Time) {
	caller := "unknown"
	if _, file, line, ok := runtime.Caller(2); ok {
		if idx := strings.LastIndex(file, "/"); idx >= 0 {
			file = file[idx+1:]
		}
		caller = file + ":" + strconv.Itoa(line)
	}
	log.Printf("[INFO] [PerformanceRepository.%s] caller=%s portfolio=%s range=[%s..%s]",
		selfName, caller, portfolioID,
		startDate.Format("2006-01-02"), endDate.Format("2006-01-02"))
}
