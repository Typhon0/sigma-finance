// Package benchmark hosts the leaf-package pure statistics used by both the
// repository layer (performance_repo.go CalculateBenchmarkComparison) and
// the service layer (performance_service.go CalculateBenchmarkComparison).
// Keeping the math here breaks the otherwise-cycle that would arise if
// either layer imported the other.
package benchmark

import (
	"sigma_finance/internal/domain/model"

	"github.com/shopspring/decimal"
)

// =============================================================================
// Daily returns
// =============================================================================

// DailyTWRReturns converts a series of AlignedPortfolioSample (Value + CostBasis)
// into daily percentage returns isolated from cash flows (deposits/withdrawals):
//
//	ΔC_t = CostBasis_t - CostBasis_{t-1}
//	NetGain_t = (Value_t - Value_{t-1}) - ΔC_t
//	CapitalBase_t = Value_{t-1} + max(0, ΔC_t)
//	r_t = (NetGain_t / CapitalBase_t) * 100
//
// When CapitalBase_t <= 0 (unfunded portfolio), r_t is 0.
// This neutralizes external capital injections/removals, preventing deposit spikes
// from corrupting Beta, Correlation, Tracking Error, and Alpha.
func DailyTWRReturns(samples []AlignedPortfolioSample) []decimal.Decimal {
	if len(samples) < 2 {
		return nil
	}
	out := make([]decimal.Decimal, 0, len(samples)-1)
	for i := 1; i < len(samples); i++ {
		prev := samples[i-1]
		curr := samples[i]

		deltaCost := curr.CostBasis - prev.CostBasis
		capitalBase := prev.Value
		if deltaCost > 0 {
			capitalBase += deltaCost
		}

		if capitalBase <= 0 {
			out = append(out, decimal.Zero)
			continue
		}

		netGain := (curr.Value - prev.Value) - deltaCost
		ret := decimal.NewFromInt(int64(netGain)).
			Div(decimal.NewFromInt(int64(capitalBase))).
			Mul(decimal.NewFromInt(100))
		out = append(out, ret)
	}
	return out
}

// CompoundTWR computes the cumulative Time-Weighted Return (TWR) in percentage:
//
//	TWR = [ Π (1 + r_t / 100) - 1 ] * 100
func CompoundTWR(dailyReturns []decimal.Decimal) decimal.Decimal {
	if len(dailyReturns) == 0 {
		return decimal.Zero
	}
	prod := decimal.NewFromInt(1)
	one := decimal.NewFromInt(1)
	hundred := decimal.NewFromInt(100)
	for _, r := range dailyReturns {
		factor := one.Add(r.Div(hundred))
		prod = prod.Mul(factor)
	}
	return prod.Sub(one).Mul(hundred)
}

// DailyMoneyReturns converts a series of Money (cents) snapshots into simple
// daily percentage returns: r_i = (v_i - v_{i-1}) / v_{i-1} * 100.
// Entries where v_{i-1} <= 0 are skipped so the result counts only matched
// steps. Returns are expressed as percentage points (already multiplied by
// 100) to match the existing convention where PortfolioReturn /
// BenchmarkReturn / TrackingError are percentages.
func DailyMoneyReturns(values []model.Money) []decimal.Decimal {
	if len(values) < 2 {
		return nil
	}
	out := make([]decimal.Decimal, 0, len(values)-1)
	for i := 1; i < len(values); i++ {
		prev := values[i-1]
		curr := values[i]
		if prev <= 0 {
			continue
		}
		ret := decimal.NewFromInt(int64(curr - prev)).
			Div(decimal.NewFromInt(int64(prev))).
			Mul(decimal.NewFromInt(100))
		out = append(out, ret)
	}
	return out
}

// DailyPriceReturns converts a series of prices (decimal.Decimal) into simple
// daily percentage returns with the same conventions as DailyMoneyReturns.
func DailyPriceReturns(prices []decimal.Decimal) []decimal.Decimal {
	if len(prices) < 2 {
		return nil
	}
	out := make([]decimal.Decimal, 0, len(prices)-1)
	for i := 1; i < len(prices); i++ {
		prev := prices[i-1]
		curr := prices[i]
		if prev.IsZero() || prev.IsNegative() {
			continue
		}
		ret := curr.Sub(prev).Div(prev).Mul(decimal.NewFromInt(100))
		out = append(out, ret)
	}
	return out
}

// =============================================================================
// Core descriptive statistics (sample statistics, Bessel-corrected: ddof=1)
// =============================================================================

// Mean returns the arithmetic mean of values. Returns decimal.Zero for n==0.
func Mean(values []decimal.Decimal) decimal.Decimal {
	if len(values) == 0 {
		return decimal.Zero
	}
	var sum decimal.Decimal
	for _, v := range values {
		sum = sum.Add(v)
	}
	return sum.Div(decimal.NewFromInt(int64(len(values))))
}

// Variance returns the sample variance. Bessel-corrected when ddof=1
// (financial convention). Returns zero when the divisor is non-positive.
func Variance(values []decimal.Decimal, ddof int) decimal.Decimal {
	n := len(values)
	if n-ddof <= 0 {
		return decimal.Zero
	}
	m := Mean(values)
	var sumSq decimal.Decimal
	for _, v := range values {
		diff := v.Sub(m)
		sumSq = sumSq.Add(diff.Mul(diff))
	}
	return sumSq.Div(decimal.NewFromInt(int64(n - ddof)))
}

// StdDev returns the sample standard deviation (Newton's method sqrt, 10
// iterations — converges for any practical financial variance magnitude).
// Returns decimal.Zero for n <= 1 or non-positive variance.
func StdDev(values []decimal.Decimal) decimal.Decimal {
	v := Variance(values, 1)
	if !v.GreaterThan(decimal.Zero) {
		return decimal.Zero
	}
	x := v.Div(decimal.NewFromInt(2))
	for i := 0; i < 10; i++ {
		x = x.Add(v.Div(x)).Div(decimal.NewFromInt(2))
	}
	return x
}

// Covariance returns the sample covariance of xs and ys (Bessel-corrected).
// Returns decimal.Zero when the two series have unequal length or fewer than
// two paired points.
func Covariance(xs, ys []decimal.Decimal) decimal.Decimal {
	n := len(xs)
	if n != len(ys) || n <= 1 {
		return decimal.Zero
	}
	mx := Mean(xs)
	my := Mean(ys)
	var sum decimal.Decimal
	for i := 0; i < n; i++ {
		dx := xs[i].Sub(mx)
		dy := ys[i].Sub(my)
		sum = sum.Add(dx.Mul(dy))
	}
	return sum.Div(decimal.NewFromInt(int64(n - 1)))
}

// PearsonCorrelation returns the Pearson correlation coefficient of xs/ys in
// the range [-1, +1]. Returns decimal.Zero when either series has zero sample
// variance or the series differ in length / are too short.
func PearsonCorrelation(xs, ys []decimal.Decimal) decimal.Decimal {
	if len(xs) != len(ys) || len(xs) <= 1 {
		return decimal.Zero
	}
	sx := StdDev(xs)
	sy := StdDev(ys)
	denom := sx.Mul(sy)
	if denom.IsZero() {
		return decimal.Zero
	}
	return Covariance(xs, ys).Div(denom)
}

// =============================================================================
// Benchmark statistics from aligned daily return series
// =============================================================================

// Beta computes Beta = Cov(R_p, R_b) / Var(R_b) using sample statistics.
// Returns decimal.Zero when there are fewer than 2 paired returns or the
// benchmark sample variance is non-positive.
func Beta(portfolioReturns, benchmarkReturns []decimal.Decimal) decimal.Decimal {
	if len(portfolioReturns) != len(benchmarkReturns) || len(portfolioReturns) < 2 {
		return decimal.Zero
	}
	varB := Variance(benchmarkReturns, 1)
	if !varB.GreaterThan(decimal.NewFromFloat(1e-12)) {
		return decimal.Zero
	}
	return Covariance(portfolioReturns, benchmarkReturns).Div(varB)
}

// TrackingError computes the sample standard deviation of the active return
// (R_p - R_b) over the alignment window. Returns zero for fewer than 2
// paired returns.
func TrackingError(portfolioReturns, benchmarkReturns []decimal.Decimal) decimal.Decimal {
	if len(portfolioReturns) != len(benchmarkReturns) || len(portfolioReturns) < 2 {
		return decimal.Zero
	}
	active := make([]decimal.Decimal, len(portfolioReturns))
	for i := range portfolioReturns {
		active[i] = portfolioReturns[i].Sub(benchmarkReturns[i])
	}
	return StdDev(active)
}

// InformationRatio computes mean(active return) / tracking error.
// Returns zero when tracking error is zero or the paired series is too short.
func InformationRatio(portfolioReturns, benchmarkReturns []decimal.Decimal) decimal.Decimal {
	if len(portfolioReturns) != len(benchmarkReturns) || len(portfolioReturns) < 2 {
		return decimal.Zero
	}
	te := TrackingError(portfolioReturns, benchmarkReturns)
	if te.IsZero() {
		return decimal.Zero
	}
	active := make([]decimal.Decimal, len(portfolioReturns))
	for i := range portfolioReturns {
		active[i] = portfolioReturns[i].Sub(benchmarkReturns[i])
	}
	return Mean(active).Div(te)
}

// JensenAlpha computes CAPM alpha: mean(R_p) - beta * mean(R_b).
// This is the daily-mean intercept of a single-factor regression. Distinct
// from the cumulative period-percentage "Alpha" field which is computed as
// PortfolioReturn - BenchmarkReturn.
func JensenAlpha(portfolioReturns, benchmarkReturns []decimal.Decimal) decimal.Decimal {
	if len(portfolioReturns) != len(benchmarkReturns) || len(portfolioReturns) < 2 {
		return decimal.Zero
	}
	beta := Beta(portfolioReturns, benchmarkReturns)
	return Mean(portfolioReturns).Sub(beta.Mul(Mean(benchmarkReturns)))
}

// AnnualizedJensenAlpha annualizes daily CAPM Jensen's Alpha using 252 trading days:
//
//	alpha_annualized = dailyAlpha * 252
func AnnualizedJensenAlpha(dailyAlpha decimal.Decimal) decimal.Decimal {
	return dailyAlpha.Mul(decimal.NewFromInt(252))
}
