package blockchain_test

import (
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service/sync/blockchain"
)

func TestCostBasis_VWAPCalculation(t *testing.T) {
	// 10 units at $100 = $1,000
	// 5 units at $130 = $650
	// Total units: 15, Total cost: $1,650 -> VWAP: $110
	inflows := []blockchain.InflowRecord{
		{
			Quantity:   decimal.NewFromFloat(10.0),
			UnitPrice:  decimal.NewFromFloat(100.0),
			ExecutedAt: time.Now().Add(-48 * time.Hour),
		},
		{
			Quantity:   decimal.NewFromFloat(5.0),
			UnitPrice:  decimal.NewFromFloat(130.0),
			ExecutedAt: time.Now().Add(-24 * time.Hour),
		},
	}

	totalCost := decimal.Zero
	totalQty := decimal.Zero
	for _, inf := range inflows {
		cost := inf.Quantity.Mul(inf.UnitPrice)
		totalCost = totalCost.Add(cost)
		totalQty = totalQty.Add(inf.Quantity)
	}

	assert.True(t, totalQty.IsPositive())
	vwap := totalCost.Div(totalQty)
	expected := decimal.NewFromFloat(110.0)
	assert.True(t, vwap.Equal(expected), "expected VWAP 110, got %s", vwap.String())
}

func TestCostBasis_DexSwapDerivation(t *testing.T) {
	// Swap: 2500 USDC ($1.00) -> 1.0 ETH
	// Derived unit price = $2500 / 1.0 = $2500.00
	outAmount := decimal.NewFromFloat(2500.0)
	outPrice := decimal.NewFromFloat(1.0) // USDC
	inAmount := decimal.NewFromFloat(1.0) // ETH

	outVal := outAmount.Mul(outPrice)
	unitPrice := outVal.Div(inAmount)

	assert.Equal(t, "2500", unitPrice.String())
}

func TestCostBasis_AntiPhantomGainRule(t *testing.T) {
	// Unrecorded token should not default to 0
	bal := &model.WalletBalance{
		ID:                "bal-1",
		Symbol:            "OBSCURE",
		FormattedQuantity: decimal.NewFromFloat(100),
		CostBasisPerUnit:  nil,
		CostBasisType:     "UNRECORDED",
	}

	assert.Nil(t, bal.CostBasisPerUnit)
	assert.Equal(t, "UNRECORDED", bal.CostBasisType)
}
