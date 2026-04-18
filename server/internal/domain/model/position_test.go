package model

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

func TestPosition_Validate(t *testing.T) {
	portfolioID := uuid.New().String()
	assetID := uuid.New().String()

	tests := []struct {
		name     string
		position *Position
		wantErr  bool
		errMsg   string
	}{
		{
			name: "valid position",
			position: &Position{
				ID:                  uuid.New().String(),
				PortfolioID:         portfolioID,
				AssetID:             assetID,
				Quantity:            decimal.NewFromFloat(100.0),
				OwnershipPercentage: decimal.NewFromFloat(100.0),
				CreatedAt:           time.Now(),
				UpdatedAt:           time.Now(),
			},
			wantErr: false,
		},
		{
			name: "valid position with partial ownership",
			position: &Position{
				ID:                  uuid.New().String(),
				PortfolioID:         portfolioID,
				AssetID:             assetID,
				Quantity:            decimal.NewFromFloat(50.0),
				OwnershipPercentage: decimal.NewFromFloat(25.5),
				CreatedAt:           time.Now(),
				UpdatedAt:           time.Now(),
			},
			wantErr: false,
		},
		{
			name: "invalid position - missing portfolio ID",
			position: &Position{
				ID:                  uuid.New().String(),
				AssetID:             assetID,
				Quantity:            decimal.NewFromFloat(100.0),
				OwnershipPercentage: decimal.NewFromFloat(100.0),
				CreatedAt:           time.Now(),
				UpdatedAt:           time.Now(),
			},
			wantErr: true,
			errMsg:  "portfolio ID is required",
		},
		{
			name: "invalid position - missing asset ID",
			position: &Position{
				ID:                  uuid.New().String(),
				PortfolioID:         portfolioID,
				Quantity:            decimal.NewFromFloat(100.0),
				OwnershipPercentage: decimal.NewFromFloat(100.0),
				CreatedAt:           time.Now(),
				UpdatedAt:           time.Now(),
			},
			wantErr: true,
			errMsg:  "asset ID is required",
		},
		{
			name: "invalid position - negative quantity",
			position: &Position{
				ID:                  uuid.New().String(),
				PortfolioID:         portfolioID,
				AssetID:             assetID,
				Quantity:            decimal.NewFromFloat(-10.0),
				OwnershipPercentage: decimal.NewFromFloat(100.0),
				CreatedAt:           time.Now(),
				UpdatedAt:           time.Now(),
			},
			wantErr: true,
			errMsg:  "quantity cannot be negative",
		},
		{
			name: "invalid position - zero ownership percentage",
			position: &Position{
				ID:                  uuid.New().String(),
				PortfolioID:         portfolioID,
				AssetID:             assetID,
				Quantity:            decimal.NewFromFloat(100.0),
				OwnershipPercentage: decimal.NewFromFloat(0.0),
				CreatedAt:           time.Now(),
				UpdatedAt:           time.Now(),
			},
			wantErr: true,
			errMsg:  "ownership percentage must be greater than 0",
		},
		{
			name: "invalid position - ownership percentage over 100",
			position: &Position{
				ID:                  uuid.New().String(),
				PortfolioID:         portfolioID,
				AssetID:             assetID,
				Quantity:            decimal.NewFromFloat(100.0),
				OwnershipPercentage: decimal.NewFromFloat(150.0),
				CreatedAt:           time.Now(),
				UpdatedAt:           time.Now(),
			},
			wantErr: true,
			errMsg:  "ownership percentage cannot exceed 100%",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.position.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Position.Validate() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && err.Error() != tt.errMsg {
				t.Errorf("Position.Validate() error = %v, want %v", err.Error(), tt.errMsg)
			}
		})
	}
}

func TestPosition_UpdateCostBasis(t *testing.T) {
	position := &Position{
		ID:                  uuid.New().String(),
		PortfolioID:         uuid.New().String(),
		AssetID:             uuid.New().String(),
		Quantity:            decimal.Zero,
		OwnershipPercentage: decimal.NewFromFloat(100.0),
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// Test first purchase
	err := position.UpdateCostBasis(
		decimal.NewFromFloat(100.0), // quantity
		decimal.NewFromFloat(0.50),  // price ($0.50 per share)
		Money(5000),                 // amount (100 * $0.50 = $50.00 = 5000 cents)
	)
	if err != nil {
		t.Errorf("UpdateCostBasis() first purchase failed: %v", err)
	}

	if !position.Quantity.Equal(decimal.NewFromFloat(100.0)) {
		t.Errorf("Expected quantity 100, got %s", position.Quantity.String())
	}
	if position.AverageCostBasis == nil || !position.AverageCostBasis.Equal(decimal.NewFromFloat(0.50)) {
		t.Errorf("Expected average cost basis 0.50, got %v", position.AverageCostBasis)
	}
	if position.TotalCostBasis == nil || *position.TotalCostBasis != Money(5000) {
		t.Errorf("Expected total cost basis 5000, got %v", position.TotalCostBasis)
	}

	// Test additional purchase
	err = position.UpdateCostBasis(
		decimal.NewFromFloat(50.0), // quantity
		decimal.NewFromFloat(0.60), // price ($0.60 per share)
		Money(3000),                // amount (50 * $0.60 = $30.00 = 3000 cents)
	)
	if err != nil {
		t.Errorf("UpdateCostBasis() additional purchase failed: %v", err)
	}

	if !position.Quantity.Equal(decimal.NewFromFloat(150.0)) {
		t.Errorf("Expected quantity 150, got %s", position.Quantity.String())
	}
	// New average should be (5000 + 3000) / 150 / 100 = 0.5333 dollars per share
	expectedAvg := decimal.NewFromFloat(0.533333)
	if position.AverageCostBasis == nil || position.AverageCostBasis.Sub(expectedAvg).Abs().GreaterThan(decimal.NewFromFloat(0.01)) {
		t.Errorf("Expected average cost basis ~0.533, got %v", position.AverageCostBasis)
	}
	if position.TotalCostBasis == nil || *position.TotalCostBasis != Money(8000) {
		t.Errorf("Expected total cost basis 8000, got %v", position.TotalCostBasis)
	}
}

func TestPosition_UpdateCostBasis_Sell(t *testing.T) {
	// Set up position with existing holdings
	position := &Position{
		ID:                  uuid.New().String(),
		PortfolioID:         uuid.New().String(),
		AssetID:             uuid.New().String(),
		Quantity:            decimal.NewFromFloat(100.0),
		OwnershipPercentage: decimal.NewFromFloat(100.0),
		AverageCostBasis:    decimalPtr(decimal.NewFromFloat(0.50)), // $0.50 per share
		TotalCostBasis:      moneyPtr(Money(5000)),                  // $50.00 total
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// Test partial sale
	err := position.UpdateCostBasis(
		decimal.NewFromFloat(-30.0), // sell 30 shares
		decimal.NewFromFloat(0.60),  // sale price ($0.60 per share)
		Money(-1800),                // amount (30 * $0.60 = $18.00 = 1800 cents, negative for sale)
	)
	if err != nil {
		t.Errorf("UpdateCostBasis() partial sale failed: %v", err)
	}

	if !position.Quantity.Equal(decimal.NewFromFloat(70.0)) {
		t.Errorf("Expected quantity 70, got %s", position.Quantity.String())
	}
	// Cost basis should be reduced proportionally: 5000 * (70/100) = 3500
	if position.TotalCostBasis == nil || *position.TotalCostBasis != Money(3500) {
		t.Errorf("Expected total cost basis 3500, got %v", position.TotalCostBasis)
	}
	// Average cost basis should remain the same
	if position.AverageCostBasis == nil || !position.AverageCostBasis.Equal(decimal.NewFromFloat(0.50)) {
		t.Errorf("Expected average cost basis 0.50, got %v", position.AverageCostBasis)
	}
}

func TestPosition_CalculateRealizedGains(t *testing.T) {
	position := &Position{
		ID:                  uuid.New().String(),
		PortfolioID:         uuid.New().String(),
		AssetID:             uuid.New().String(),
		Quantity:            decimal.NewFromFloat(100.0),
		OwnershipPercentage: decimal.NewFromFloat(100.0),
		AverageCostBasis:    decimalPtr(decimal.NewFromFloat(0.50)), // $0.50 per share
		TotalCostBasis:      moneyPtr(Money(5000)),                  // $50.00 total
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// Test realized gains calculation
	gains, err := position.CalculateRealizedGains(
		decimal.NewFromFloat(30.0), // sell 30 shares
		decimal.NewFromFloat(0.60), // at $0.60 per share
	)
	if err != nil {
		t.Errorf("CalculateRealizedGains() failed: %v", err)
	}

	// Expected: (30 * 0.60 * 100) - (30 * 0.50 * 100) = 1800 - 1500 = 300 cents gain
	expectedGains := Money(300)
	if gains != expectedGains {
		t.Errorf("Expected realized gains %d, got %d", expectedGains, gains)
	}

	// Test selling more than available
	_, err = position.CalculateRealizedGains(
		decimal.NewFromFloat(150.0), // try to sell 150 shares
		decimal.NewFromFloat(0.60),
	)
	if err == nil {
		t.Error("Expected error when selling more than available quantity")
	}
}

func TestPosition_CalculateValue(t *testing.T) {
	position := &Position{
		ID:                  uuid.New().String(),
		PortfolioID:         uuid.New().String(),
		AssetID:             uuid.New().String(),
		Quantity:            decimal.NewFromFloat(100.0),
		OwnershipPercentage: decimal.NewFromFloat(100.0),
		AverageCostBasis:    decimalPtr(decimal.NewFromFloat(0.50)), // $0.50 per share
		TotalCostBasis:      moneyPtr(Money(5000)),                  // $50.00 total
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	currentPrice := decimal.NewFromFloat(0.60) // $0.60 per share
	value := position.CalculateValue(&currentPrice)

	// Expected current value: 100 * 0.60 * 1.0 * 100 = 6000 cents
	expectedValue := Money(6000)
	if value.CurrentValue != expectedValue {
		t.Errorf("Expected current value %d, got %d", expectedValue, value.CurrentValue)
	}

	// Expected unrealized gain: 6000 - 5000 = 1000 cents
	expectedGain := Money(1000)
	if value.UnrealizedGainLoss != expectedGain {
		t.Errorf("Expected unrealized gain %d, got %d", expectedGain, value.UnrealizedGainLoss)
	}

	// Expected gain percentage: 1000 / 5000 * 100 = 20%
	expectedPercentage := decimal.NewFromFloat(20.0)
	if value.UnrealizedGainLossPercentage == nil || !value.UnrealizedGainLossPercentage.Equal(expectedPercentage) {
		t.Errorf("Expected gain percentage 20%%, got %v", value.UnrealizedGainLossPercentage)
	}
}

func TestPosition_GetEffectiveQuantity(t *testing.T) {
	position := &Position{
		Quantity:            decimal.NewFromFloat(100.0),
		OwnershipPercentage: decimal.NewFromFloat(25.0),
	}

	effective := position.GetEffectiveQuantity()
	expected := decimal.NewFromFloat(25.0) // 100 * 0.25

	if !effective.Equal(expected) {
		t.Errorf("Expected effective quantity %s, got %s", expected.String(), effective.String())
	}
}

// Helper functions
func decimalPtr(d decimal.Decimal) *decimal.Decimal {
	return &d
}

func moneyPtr(m Money) *Money {
	return &m
}
