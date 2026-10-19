package model

import (
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTaxLotAllocation_FIFO(t *testing.T) {
	now := time.Now()
	// Lot 1: 10 shares @ $100 bought 400 days ago (Long-Term)
	lot1 := &TaxLot{
		ID:                "lot-1",
		AcquiredAt:        now.AddDate(0, 0, -400),
		InitialQuantity:   decimal.NewFromInt(10),
		RemainingQuantity: decimal.NewFromInt(10),
		CostBasisPerUnit:  decimal.NewFromInt(100),
		Status:            TaxLotStatusOpen,
	}
	// Lot 2: 10 shares @ $150 bought 100 days ago (Short-Term)
	lot2 := &TaxLot{
		ID:                "lot-2",
		AcquiredAt:        now.AddDate(0, 0, -100),
		InitialQuantity:   decimal.NewFromInt(10),
		RemainingQuantity: decimal.NewFromInt(10),
		CostBasisPerUnit:  decimal.NewFromInt(150),
		Status:            TaxLotStatusOpen,
	}

	lots := []*TaxLot{lot2, lot1} // intentionally unordered

	// Sell 15 shares @ $200
	result, err := AllocateTaxLots(lots, decimal.NewFromInt(15), decimal.NewFromInt(200), now, TaxLotMethodFIFO)
	require.NoError(t, err)
	require.Len(t, result.Matches, 2)

	// First match should be Lot 1 (10 shares)
	m1 := result.Matches[0]
	assert.Equal(t, "lot-1", m1.LotID)
	assert.Equal(t, "10", m1.Quantity.String())
	assert.Equal(t, Money(100000), m1.CostBasis)       // 10 * $100 = $1,000 = 100,000 cents
	assert.Equal(t, Money(200000), m1.Proceeds)        // 10 * $200 = $2,000 = 200,000 cents
	assert.Equal(t, Money(100000), m1.RealizedGainLoss) // +$1,000 gain
	assert.True(t, m1.IsLongTerm)

	// Second match should be Lot 2 (5 shares partial)
	m2 := result.Matches[1]
	assert.Equal(t, "lot-2", m2.LotID)
	assert.Equal(t, "5", m2.Quantity.String())
	assert.Equal(t, Money(75000), m2.CostBasis)       // 5 * $150 = $750 = 75,000 cents
	assert.Equal(t, Money(100000), m2.Proceeds)       // 5 * $200 = $1,000 = 100,000 cents
	assert.Equal(t, Money(25000), m2.RealizedGainLoss) // +$250 gain
	assert.False(t, m2.IsLongTerm)

	// Totals
	assert.Equal(t, Money(175000), result.TotalCostBasis)
	assert.Equal(t, Money(300000), result.TotalProceeds)
	assert.Equal(t, Money(125000), result.TotalRealizedGainLoss)
	assert.Equal(t, Money(100000), result.LongTermGainLoss)
	assert.Equal(t, Money(25000), result.ShortTermGainLoss)

	// Verify Lot states
	assert.Equal(t, TaxLotStatusClosed, lot1.Status)
	assert.Equal(t, "0", lot1.RemainingQuantity.String())
	assert.Equal(t, TaxLotStatusPartiallyClosed, lot2.Status)
	assert.Equal(t, "5", lot2.RemainingQuantity.String())
}

func TestTaxLotAllocation_HIFO(t *testing.T) {
	now := time.Now()
	// Lot 1: 10 shares @ $100
	lot1 := &TaxLot{
		ID:                "lot-1",
		AcquiredAt:        now.AddDate(0, 0, -200),
		InitialQuantity:   decimal.NewFromInt(10),
		RemainingQuantity: decimal.NewFromInt(10),
		CostBasisPerUnit:  decimal.NewFromInt(100),
		Status:            TaxLotStatusOpen,
	}
	// Lot 2: 10 shares @ $180 (Highest Cost)
	lot2 := &TaxLot{
		ID:                "lot-2",
		AcquiredAt:        now.AddDate(0, 0, -100),
		InitialQuantity:   decimal.NewFromInt(10),
		RemainingQuantity: decimal.NewFromInt(10),
		CostBasisPerUnit:  decimal.NewFromInt(180),
		Status:            TaxLotStatusOpen,
	}

	lots := []*TaxLot{lot1, lot2}

	// Sell 5 shares @ $200 using HIFO
	result, err := AllocateTaxLots(lots, decimal.NewFromInt(5), decimal.NewFromInt(200), now, TaxLotMethodHIFO)
	require.NoError(t, err)
	require.Len(t, result.Matches, 1)

	// Should match highest cost lot first (Lot 2)
	assert.Equal(t, "lot-2", result.Matches[0].LotID)
	assert.Equal(t, Money(90000), result.TotalCostBasis)       // 5 * $180 = $900 = 90,000 cents
	assert.Equal(t, Money(100000), result.TotalProceeds)       // 5 * $200 = $1,000 = 100,000 cents
	assert.Equal(t, Money(10000), result.TotalRealizedGainLoss) // Minimal gain = $100
}

func TestTaxLotAllocation_InsufficientQuantity(t *testing.T) {
	now := time.Now()
	lot := &TaxLot{
		ID:                "lot-1",
		AcquiredAt:        now,
		InitialQuantity:   decimal.NewFromInt(5),
		RemainingQuantity: decimal.NewFromInt(5),
		CostBasisPerUnit:  decimal.NewFromInt(100),
		Status:            TaxLotStatusOpen,
	}

	_, err := AllocateTaxLots([]*TaxLot{lot}, decimal.NewFromInt(10), decimal.NewFromInt(100), now, TaxLotMethodFIFO)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "insufficient quantity")
}

func TestTaxLotAllocation_PMP(t *testing.T) {
	now := time.Now()
	// Lot 1: 10 shares @ $100 -> Cost = $1000
	lot1 := &TaxLot{
		ID:                "lot-1",
		AcquiredAt:        now.AddDate(0, 0, -200),
		InitialQuantity:   decimal.NewFromInt(10),
		RemainingQuantity: decimal.NewFromInt(10),
		CostBasisPerUnit:  decimal.NewFromInt(100),
		Status:            TaxLotStatusOpen,
	}
	// Lot 2: 10 shares @ $200 -> Cost = $2000
	// Total pool: 20 shares, total cost $3000 -> PMP = $150/unit
	lot2 := &TaxLot{
		ID:                "lot-2",
		AcquiredAt:        now.AddDate(0, 0, -100),
		InitialQuantity:   decimal.NewFromInt(10),
		RemainingQuantity: decimal.NewFromInt(10),
		CostBasisPerUnit:  decimal.NewFromInt(200),
		Status:            TaxLotStatusOpen,
	}

	lots := []*TaxLot{lot1, lot2}

	// Sell 15 shares @ $250 using PMP
	// 15 shares * $150 = $2250 cost basis (225000 cents)
	// Proceeds = 15 * $250 = $3750 (375000 cents)
	// Realized gain = $1500 (150000 cents)
	result, err := AllocateTaxLots(lots, decimal.NewFromInt(15), decimal.NewFromInt(250), now, TaxLotMethodPMP)
	require.NoError(t, err)
	require.Len(t, result.Matches, 2)

	assert.Equal(t, Money(225000), result.TotalCostBasis)
	assert.Equal(t, Money(375000), result.TotalProceeds)
	assert.Equal(t, Money(150000), result.TotalRealizedGainLoss)

	// First match (lot 1, 10 shares)
	m1 := result.Matches[0]
	assert.Equal(t, "lot-1", m1.LotID)
	assert.Equal(t, "10", m1.Quantity.String())
	assert.Equal(t, Money(150000), m1.CostBasis) // 10 * $150

	// Second match (lot 2, 5 shares)
	m2 := result.Matches[1]
	assert.Equal(t, "lot-2", m2.LotID)
	assert.Equal(t, "5", m2.Quantity.String())
	assert.Equal(t, Money(75000), m2.CostBasis) // 5 * $150
}

func TestNewDispositionsFromAllocation_TaxExempt(t *testing.T) {
	now := time.Now()
	lot := &TaxLot{
		ID:                "lot-1",
		AcquiredAt:        now.AddDate(0, 0, -50),
		InitialQuantity:   decimal.NewFromInt(10),
		RemainingQuantity: decimal.NewFromInt(10),
		CostBasisPerUnit:  decimal.NewFromInt(100),
		Status:            TaxLotStatusOpen,
	}

	result, err := AllocateTaxLots([]*TaxLot{lot}, decimal.NewFromInt(5), decimal.NewFromInt(150), now, TaxLotMethodFIFO)
	require.NoError(t, err)

	txID := "tx-123"
	disps := NewDispositionsFromAllocation(result, "port-1", "pos-1", "asset-1", &txID, true)
	require.Len(t, disps, 1)
	assert.True(t, disps[0].IsTaxExempt)
	assert.Equal(t, "port-1", disps[0].PortfolioID)
	assert.Equal(t, "tx-123", *disps[0].TransactionID)
}

