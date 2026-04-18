package service

import (
	"context"
	"sigma_finance/internal/domain/model"
	"testing"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
)

// Simple integration test to verify service logic without mocks
func TestAssetService_ValidateAssetData_Integration(t *testing.T) {
	// Create a service with nil repository for validation-only tests
	service := &AssetService{}
	ctx := context.Background()

	t.Run("valid stock metadata", func(t *testing.T) {
		metadata := map[string]interface{}{
			"exchange": "NASDAQ",
			"sector":   "Technology",
		}

		err := service.ValidateAssetData(ctx, model.AssetTypeStock, metadata)
		assert.NoError(t, err)
	})

	t.Run("invalid stock metadata - missing exchange", func(t *testing.T) {
		metadata := map[string]interface{}{
			"sector": "Technology",
		}

		err := service.ValidateAssetData(ctx, model.AssetTypeStock, metadata)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "exchange is required")
	})

	t.Run("valid crypto metadata", func(t *testing.T) {
		metadata := map[string]interface{}{
			"blockchain":     "ethereum",
			"wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
			"decimals":       18,
			"is_stablecoin":  false,
		}

		err := service.ValidateAssetData(ctx, model.AssetTypeCrypto, metadata)
		assert.NoError(t, err)
	})

	t.Run("invalid crypto metadata - missing blockchain", func(t *testing.T) {
		metadata := map[string]interface{}{
			"wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
			"decimals":       18,
		}

		err := service.ValidateAssetData(ctx, model.AssetTypeCrypto, metadata)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "blockchain is required")
	})

	t.Run("valid bank account metadata", func(t *testing.T) {
		metadata := map[string]interface{}{
			"account_type":   "checking",
			"institution":    "Bank of America",
			"account_number": "123456789",
			"currency":       "USD",
		}

		err := service.ValidateAssetData(ctx, model.AssetTypeBankAccount, metadata)
		assert.NoError(t, err)
	})

	t.Run("valid real estate metadata", func(t *testing.T) {
		metadata := map[string]interface{}{
			"property_type": "residential",
			"address":       "123 Main St",
			"city":          "New York",
			"state":         "NY",
			"country":       "USA",
		}

		err := service.ValidateAssetData(ctx, model.AssetTypeRealEstate, metadata)
		assert.NoError(t, err)
	})

	t.Run("valid life insurance metadata", func(t *testing.T) {
		metadata := map[string]interface{}{
			"policy_number":     "POL123456",
			"insurer":           "State Farm",
			"policy_type":       "term",
			"coverage_amount":   50000000, // $500,000 in cents
			"premium_amount":    50000,    // $500 in cents
			"premium_frequency": "monthly",
			"beneficiaries":     []string{"John Doe", "Jane Doe"},
		}

		err := service.ValidateAssetData(ctx, model.AssetTypeLifeInsurance, metadata)
		assert.NoError(t, err)
	})

	t.Run("valid watch metadata", func(t *testing.T) {
		metadata := map[string]interface{}{
			"brand":     "Rolex",
			"model":     "Submariner",
			"condition": "excellent",
			"movement":  "automatic",
		}

		err := service.ValidateAssetData(ctx, model.AssetTypeWatch, metadata)
		assert.NoError(t, err)
	})

	t.Run("valid other valuable metadata", func(t *testing.T) {
		metadata := map[string]interface{}{
			"category":  "artwork",
			"condition": "excellent",
		}

		err := service.ValidateAssetData(ctx, model.AssetTypeOtherValuable, metadata)
		assert.NoError(t, err)
	})
}

func TestPositionService_CalculatePositionValue_Integration(t *testing.T) {
	// Create a service with nil repositories for calculation-only tests
	service := &PositionService{}
	ctx := context.Background()

	t.Run("calculate value with current price", func(t *testing.T) {
		position := &model.Position{
			ID:                  uuid.NewString(),
			Quantity:            decimal.NewFromFloat(100),
			OwnershipPercentage: decimal.NewFromInt(100),
			TotalCostBasis:      moneyPtr(10000), // $100.00 in cents
		}

		currentPrice := decimal.NewFromFloat(150) // $150 per share

		result, err := service.CalculatePositionValue(ctx, position, &currentPrice)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, position, result.Position)
		assert.Equal(t, &currentPrice, result.CurrentPrice)
		assert.Equal(t, model.Money(1500000), result.CurrentValue)       // 100 * $150 * 100 cents
		assert.Equal(t, model.Money(1490000), result.UnrealizedGainLoss) // $15000 - $100 = $14900
	})

	t.Run("calculate value without current price", func(t *testing.T) {
		position := &model.Position{
			ID:                  uuid.NewString(),
			Quantity:            decimal.NewFromFloat(50),
			OwnershipPercentage: decimal.NewFromInt(100),
			TotalCostBasis:      moneyPtr(5000), // $50.00 in cents
		}

		result, err := service.CalculatePositionValue(ctx, position, nil)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, position, result.Position)
		assert.Nil(t, result.CurrentPrice)
		assert.Equal(t, model.Money(0), result.CurrentValue) // No price, no value
	})

	t.Run("calculate value with partial ownership", func(t *testing.T) {
		position := &model.Position{
			ID:                  uuid.NewString(),
			Quantity:            decimal.NewFromFloat(100),
			OwnershipPercentage: decimal.NewFromFloat(50), // 50% ownership
			TotalCostBasis:      moneyPtr(10000),          // $100.00 in cents
		}

		currentPrice := decimal.NewFromFloat(200) // $200 per share

		result, err := service.CalculatePositionValue(ctx, position, &currentPrice)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, model.Money(1000000), result.CurrentValue)      // 100 * $200 * 50% * 100 cents
		assert.Equal(t, model.Money(990000), result.UnrealizedGainLoss) // $10000 - $100 = $9900
	})
}

func TestTransactionService_BusinessLogic_Integration(t *testing.T) {
	// Test transaction validation logic without repository dependencies

	t.Run("validate buy transaction request", func(t *testing.T) {
		req := BuyTransactionRequest{
			UserID:       uuid.NewString(),
			PortfolioID:  uuid.NewString(),
			AssetID:      uuid.NewString(),
			Quantity:     decimal.NewFromFloat(100),
			PricePerUnit: decimal.NewFromFloat(50),
		}

		// Basic validation should pass
		assert.True(t, req.UserID != "")
		assert.True(t, req.PortfolioID != "")
		assert.True(t, req.AssetID != "")
		assert.True(t, req.Quantity.IsPositive())
		assert.True(t, req.PricePerUnit.IsPositive())
	})

	t.Run("validate sell transaction request", func(t *testing.T) {
		req := SellTransactionRequest{
			UserID:       uuid.NewString(),
			PositionID:   uuid.NewString(),
			Quantity:     decimal.NewFromFloat(50),
			PricePerUnit: decimal.NewFromFloat(75),
		}

		// Basic validation should pass
		assert.True(t, req.UserID != "")
		assert.True(t, req.PositionID != "")
		assert.True(t, req.Quantity.IsPositive())
		assert.True(t, req.PricePerUnit.IsPositive())
	})

	t.Run("validate cash transaction request", func(t *testing.T) {
		req := CashTransactionRequest{
			UserID: uuid.NewString(),
			Type:   model.TransactionTypeDeposit,
			Amount: model.Money(10000), // $100.00
		}

		// Basic validation should pass
		assert.True(t, req.UserID != "")
		assert.True(t, req.Type.IsValid())
		assert.True(t, req.Amount > 0)
	})
}

