package benchmark_test

import (
	"testing"
	"time"

	"sigma_finance/internal/benchmark"
	"sigma_finance/internal/domain/model"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDailyTWRReturns_NoCashFlows(t *testing.T) {
	// Standard price growth without deposits/withdrawals:
	// Day 0: $100 value, $100 cost
	// Day 1: $110 value, $100 cost (+10%)
	// Day 2: $104.50 value, $100 cost (-5%)
	samples := []benchmark.AlignedPortfolioSample{
		{Value: 10000, CostBasis: 10000},
		{Value: 11000, CostBasis: 10000},
		{Value: 10450, CostBasis: 10000},
	}

	returns := benchmark.DailyTWRReturns(samples)
	require.Len(t, returns, 2)

	assert.Equal(t, "10.0", returns[0].StringFixed(1))
	assert.Equal(t, "-5.0", returns[1].StringFixed(1))

	compound := benchmark.CompoundTWR(returns)
	// (1 + 0.10) * (1 - 0.05) - 1 = 1.045 - 1 = 4.5%
	assert.Equal(t, "4.50", compound.StringFixed(2))
}

func TestDailyTWRReturns_DepositSpikeNeutralization(t *testing.T) {
	// The exact user issue:
	// Day 0: $100 value, $100 cost
	// Day 1: $8,100 value, $8,100 cost (Deposit of $8,000 and purchased $8,000 at market price)
	// Day 2: $8,505 value, $8,100 cost (+5% market gain on the $8,100 portfolio)
	samples := []benchmark.AlignedPortfolioSample{
		{Value: 10000, CostBasis: 10000},   // $100
		{Value: 810000, CostBasis: 810000}, // $8,100 (+$8,000 cash flow)
		{Value: 850500, CostBasis: 810000}, // $8,505 (+5% asset move)
	}

	returns := benchmark.DailyTWRReturns(samples)
	require.Len(t, returns, 2)

	// Day 1 return MUST be 0%, NOT +8000%!
	assert.Equal(t, "0.00", returns[0].StringFixed(2))
	// Day 2 return MUST be +5.00%
	assert.Equal(t, "5.00", returns[1].StringFixed(2))

	compound := benchmark.CompoundTWR(returns)
	// True investment performance is 5.00%, NOT +8405%!
	assert.Equal(t, "5.00", compound.StringFixed(2))
}

func TestDailyTWRReturns_WithdrawalNeutralization(t *testing.T) {
	// Withdrawal:
	// Day 0: $10,000 value, $10,000 cost
	// Day 1: $7,000 value, $7,000 cost (Withdrawal of $3,000, market neutral)
	// Day 2: $7,140 value, $7,000 cost (+2% market move)
	samples := []benchmark.AlignedPortfolioSample{
		{Value: 1000000, CostBasis: 1000000},
		{Value: 700000, CostBasis: 700000},
		{Value: 714000, CostBasis: 700000},
	}

	returns := benchmark.DailyTWRReturns(samples)
	require.Len(t, returns, 2)

	// Day 1 withdrawal should not trigger a -30% fake loss
	assert.Equal(t, "0.00", returns[0].StringFixed(2))
	// Day 2 return is +2.00%
	assert.Equal(t, "2.00", returns[1].StringFixed(2))

	compound := benchmark.CompoundTWR(returns)
	assert.Equal(t, "2.00", compound.StringFixed(2))
}

func TestAlignDaily_WithCostBasis(t *testing.T) {
	now := time.Date(2026, 4, 1, 10, 0, 0, 0, time.UTC)
	port := []benchmark.PortfolioSample{
		{Timestamp: now, Value: 10000, CostBasis: 10000},
		{Timestamp: now.AddDate(0, 0, 1), Value: 800000, CostBasis: 800000},
	}
	bench := []benchmark.BenchmarkSample{
		{Timestamp: now, Price: decimal.NewFromFloat(5000.0)},
		{Timestamp: now.AddDate(0, 0, 1), Price: decimal.NewFromFloat(5050.0)},
	}

	alignedPort, alignedBench := benchmark.AlignDaily(port, bench)
	require.Len(t, alignedPort, 2)
	require.Len(t, alignedBench, 2)

	assert.Equal(t, model.Money(10000), alignedPort[0].Value)
	assert.Equal(t, model.Money(10000), alignedPort[0].CostBasis)
	assert.Equal(t, model.Money(800000), alignedPort[1].Value)
	assert.Equal(t, model.Money(800000), alignedPort[1].CostBasis)

	portReturns := benchmark.DailyTWRReturns(alignedPort)
	benchReturns := benchmark.DailyPriceReturns(alignedBench)

	require.Len(t, portReturns, 1)
	require.Len(t, benchReturns, 1)

	// Portfolio return is 0 (neutralized deposit), benchmark is +1% (5050 vs 5000)
	assert.Equal(t, "0.00", portReturns[0].StringFixed(2))
	assert.Equal(t, "1.00", benchReturns[0].StringFixed(2))
}
