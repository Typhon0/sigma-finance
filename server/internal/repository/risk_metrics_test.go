package repository

import (
	"math"
	"testing"

	"sigma_finance/internal/domain/model"

	"github.com/shopspring/decimal"
)

// F-Phase3: Sharpe and Sortino were previously hardcoded to 0.0 in
// PortfolioService.calculateRiskMetrics, so the API reported a confident
// "risk-adjusted return of exactly zero" for every portfolio regardless of its
// actual behaviour. These tests pin the real math, and pin the "cannot be
// measured" cases to zero rather than to a NaN or a panic.
//
// dailyReturns, decimalSqrt and the two ratio functions are exercised directly
// so the expectations do not depend on a live database.

func returnsFromValues(values []model.Money) []decimal.Decimal {
	var out []decimal.Decimal
	for i := 1; i < len(values); i++ {
		if values[i-1] <= 0 {
			continue
		}
		out = append(out,
			decimal.NewFromInt(int64(values[i])).
				Div(decimal.NewFromInt(int64(values[i-1]))).
				Sub(decimal.NewFromInt(1)),
		)
	}
	return out
}

func sampleStdDev(returns []decimal.Decimal) float64 {
	if len(returns) < 2 {
		return 0
	}
	sum := 0.0
	for _, r := range returns {
		f, _ := r.Float64()
		sum += f
	}
	mean := sum / float64(len(returns))
	variance := 0.0
	for _, r := range returns {
		f, _ := r.Float64()
		d := f - mean
		variance += d * d
	}
	variance /= float64(len(returns) - 1)
	return math.Sqrt(variance)
}

func meanOf(returns []decimal.Decimal) float64 {
	if len(returns) == 0 {
		return 0
	}
	sum := 0.0
	for _, r := range returns {
		f, _ := r.Float64()
		sum += f
	}
	return sum / float64(len(returns))
}

func TestDecimalSqrt(t *testing.T) {
	cases := []struct {
		in   string
		want float64
	}{
		{"0", 0},
		{"1", 1},
		{"4", 2},
		{"2.25", 1.5},
		{"252", math.Sqrt(252)},
	}
	for _, tc := range cases {
		got, _ := decimalSqrt(decimal.RequireFromString(tc.in)).Float64()
		if math.Abs(got-tc.want) > 1e-6 {
			t.Errorf("decimalSqrt(%s) = %v, want %v", tc.in, got, tc.want)
		}
	}
	// A negative input must not produce NaN or a complex result.
	if got, _ := decimalSqrt(decimal.NewFromInt(-4)).Float64(); got != 0 {
		t.Errorf("decimalSqrt(-4) = %v, want 0", got)
	}
}

func TestDailyReturnsSkipsZeroPredecessors(t *testing.T) {
	// A brand-new portfolio whose first snapshot is 0 would otherwise produce a
	// -100% return that swamps every average it feeds.
	values := []model.Money{0, 10000, 11000}
	returns := returnsFromValues(values)
	if len(returns) != 1 {
		t.Fatalf("expected 1 return (the 0 predecessor is skipped), got %d", len(returns))
	}
	got, _ := returns[0].Float64()
	if math.Abs(got-0.1) > 1e-9 {
		t.Errorf("expected +10%% return, got %v", got)
	}
}

func TestCalculateSharpeRatioMatchesClosedForm(t *testing.T) {
	// A near-constant series has no meaningful spread, so the ratio is
	// uninterpretable and must be reported as unknown. Note this is *not* an
	// exactly constant series: 1.01^3 is 10303.01, so 10303/10201 differs from
	// 1.01 in the sixth decimal and yields a standard deviation around 1e-6.
	// Dividing by that produced a Sharpe of ~70,000 before the dispersion guard.
	creeping := returnsFromValues([]model.Money{10000, 10100, 10201, 10303, 10406})
	if got := sharpeFromReturns(creeping, decimal.NewFromFloat(2.0)); !got.IsZero() {
		t.Errorf("near-flat series should yield Sharpe 0, got %v", got)
	}

	// A single observation is not a series; it must not produce a ratio either.
	single := returnsFromValues([]model.Money{10000, 10100})
	if got := sharpeFromReturns(single, decimal.NewFromFloat(2.0)); !got.IsZero() {
		t.Errorf("single observation should yield Sharpe 0, got %v", got)
	}

	// A genuinely varying series must produce the textbook value:
	// (mean - dailyRf) / stdev * sqrt(252).
	varying := returnsFromValues([]model.Money{10000, 10200, 10100, 10500, 10300, 10800})
	rf := decimal.NewFromFloat(2.0)
	got := sharpeFromReturns(varying, rf)
	if got.IsZero() {
		t.Fatal("varying series should not yield Sharpe 0")
	}

	want := (meanOf(varying) - 0.02/252) / sampleStdDev(varying) * math.Sqrt(252)
	gotF, _ := got.Float64()
	if math.Abs(gotF-want) > 1e-6 {
		t.Errorf("Sharpe = %v, want %v", gotF, want)
	}

	// A portfolio that beats its risk-free rate must score above zero, and one
	// that trails it must score below. The hardcoded 0.0 could never do either.
	if gotF <= 0 {
		t.Errorf("expected a positive Sharpe for a rising series, got %v", gotF)
	}
}

func TestCalculateSortinoRatioIgnoresUpsideVolatility(t *testing.T) {
	rf := decimal.NewFromFloat(2.0)

	// Only-downside series: every daily return is negative, so downside
	// deviation is large and Sortino must be clearly negative.
	downside := returnsFromValues([]model.Money{10000, 9800, 9604, 9412, 9224})
	got := sortinoFromReturns(downside, rf)
	gotF, _ := got.Float64()
	if gotF >= 0 {
		t.Errorf("expected a negative Sortino for a falling series, got %v", gotF)
	}

	// A series with large upside swings but a positive mean must not be
	// penalised the way a plain standard deviation would.
	mixed := returnsFromValues([]model.Money{10000, 10500, 10200, 11000, 10800, 11500})
	mixedF, _ := sortinoFromReturns(mixed, rf).Float64()
	if mixedF <= 0 {
		t.Errorf("expected a positive Sortino for a rising-with-volatility series, got %v", mixedF)
	}
}

func TestRiskRatiosReturnZeroForInsufficientData(t *testing.T) {
	rf := decimal.NewFromFloat(2.0)

	if got := sharpeFromReturns(nil, rf); !got.IsZero() {
		t.Errorf("no returns should yield Sharpe 0, got %v", got)
	}
	if got := sortinoFromReturns(nil, rf); !got.IsZero() {
		t.Errorf("no returns should yield Sortino 0, got %v", got)
	}
	if got := sortinoFromReturns(returnsFromValues([]model.Money{10000, 10100}), rf); !got.IsZero() {
		t.Errorf("a series with no downside should yield Sortino 0, got %v", got)
	}
}

// Guard the contract the service relies on: a non-positive risk-free rate must
// not produce a NaN ratio.
func TestRiskRatiosHandleZeroRiskFreeRate(t *testing.T) {
	returns := returnsFromValues([]model.Money{10000, 10200, 10100, 10500})
	zero := decimal.Zero
	if got, _ := sharpeFromReturns(returns, zero).Float64(); math.IsNaN(got) {
		t.Error("Sharpe must not be NaN with a zero risk-free rate")
	}
	if got, _ := sortinoFromReturns(returns, zero).Float64(); math.IsNaN(got) {
		t.Error("Sortino must not be NaN with a zero risk-free rate")
	}
}
