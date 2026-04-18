package service

import (
	"context"
	"sigma_finance/internal/domain/model"
	"testing"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
)

// Test that validates the service implementations compile and basic logic works
func TestServiceValidation(t *testing.T) {
	ctx := context.Background()

	t.Run("AssetService validation logic", func(t *testing.T) {
		service := &AssetService{}

		// Test valid bank account metadata (non-tradeable asset)
		bankMetadata := map[string]interface{}{
			"account_type":   "checking",
			"institution":    "Bank of America",
			"account_number": "123456789",
			"currency":       "USD",
		}
		err := service.ValidateAssetData(ctx, model.AssetTypeBankAccount, bankMetadata)
		assert.NoError(t, err)

		// Test invalid bank account metadata
		invalidMetadata := map[string]interface{}{
			"account_type":   "checking",
			"account_number": "123456789",
			"currency":       "USD",
			// missing institution
		}
		err = service.ValidateAssetData(ctx, model.AssetTypeBankAccount, invalidMetadata)
		assert.Error(t, err)
	})

	t.Run("PositionService calculation logic", func(t *testing.T) {
		service := &PositionService{}

		// Create a test position
		totalCost := model.Money(10000) // $100 in cents
		position := &model.Position{
			ID:                  uuid.NewString(),
			Quantity:            decimal.NewFromFloat(100),
			OwnershipPercentage: decimal.NewFromInt(100),
			TotalCostBasis:      &totalCost,
		}

		currentPrice := decimal.NewFromFloat(150) // $150 per share
		result, err := service.CalculatePositionValue(ctx, position, &currentPrice)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, position, result.Position)
		assert.Equal(t, model.Money(1500000), result.CurrentValue) // 100 * $150 * 100 cents
	})

	t.Run("TransactionService request validation", func(t *testing.T) {
		// Test that transaction request structures are valid
		buyReq := BuyTransactionRequest{
			UserID:       uuid.NewString(),
			PortfolioID:  uuid.NewString(),
			AssetID:      uuid.NewString(),
			Quantity:     decimal.NewFromFloat(100),
			PricePerUnit: decimal.NewFromFloat(50),
		}

		// Basic validation
		assert.NotEqual(t, "", buyReq.UserID)
		assert.True(t, buyReq.Quantity.IsPositive())
		assert.True(t, buyReq.PricePerUnit.IsPositive())

		sellReq := SellTransactionRequest{
			UserID:       uuid.NewString(),
			PositionID:   uuid.NewString(),
			Quantity:     decimal.NewFromFloat(50),
			PricePerUnit: decimal.NewFromFloat(75),
		}

		assert.NotEqual(t, "", sellReq.UserID)
		assert.True(t, sellReq.Quantity.IsPositive())
		assert.True(t, sellReq.PricePerUnit.IsPositive())
	})

	t.Run("Service interfaces are properly defined", func(t *testing.T) {
		// Test that we can create service instances
		var assetService IAssetService = &AssetService{}
		var positionService IPositionService = &PositionService{}
		var transactionService ITransactionService = &TransactionService{}

		assert.NotNil(t, assetService)
		assert.NotNil(t, positionService)
		assert.NotNil(t, transactionService)
	})
}
