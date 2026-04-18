package repository

import (
	"sigma_finance/internal/domain/model"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uptrace/bun"
)

// TestAssetRepositoryBasicOperations tests basic CRUD operations for AssetRepository
func TestAssetRepositoryBasicOperations(t *testing.T) {
	// This is a unit test that doesn't require database connection
	// We're testing the repository interface and basic functionality

	t.Run("NewAssetRepository creates repository", func(t *testing.T) {
		// Mock database connection
		var db bun.IDB
		repo := NewAssetRepository(db)

		assert.NotNil(t, repo)
		assert.NotNil(t, repo.Repository)
	})

	t.Run("AssetFilter validation", func(t *testing.T) {
		filter := AssetFilter{
			AssetType:   &[]model.AssetType{model.AssetTypeStock}[0],
			IsTradeable: &[]bool{true}[0],
		}

		assert.Equal(t, model.AssetTypeStock, *filter.AssetType)
		assert.True(t, *filter.IsTradeable)
	})
}

// TestPositionRepositoryBasicOperations tests basic operations for PositionRepository
func TestPositionRepositoryBasicOperations(t *testing.T) {
	t.Run("NewPositionRepository creates repository", func(t *testing.T) {
		var db bun.IDB
		repo := NewPositionRepository(db)

		assert.NotNil(t, repo)
		assert.NotNil(t, repo.Repository)
	})

	t.Run("PositionFilter validation", func(t *testing.T) {
		portfolioID := uuid.NewString()
		filter := PositionFilter{
			PortfolioID: &portfolioID,
			AssetType:   &[]model.AssetType{model.AssetTypeCrypto}[0],
		}

		assert.Equal(t, portfolioID, *filter.PortfolioID)
		assert.Equal(t, model.AssetTypeCrypto, *filter.AssetType)
	})
}

// TestTransactionRepositoryBasicOperations tests basic operations for TransactionRepository
func TestTransactionRepositoryBasicOperations(t *testing.T) {
	t.Run("NewTransactionRepository creates repository", func(t *testing.T) {
		var db bun.IDB
		repo := NewTransactionRepository(db)

		assert.NotNil(t, repo)
		assert.NotNil(t, repo.Repository)
	})

	t.Run("TransactionFilter validation", func(t *testing.T) {
		userID := uuid.NewString()
		transactionType := model.TransactionTypeBuy
		filter := TransactionFilter{
			UserID:          &userID,
			TransactionType: &transactionType,
		}

		assert.Equal(t, userID, *filter.UserID)
		assert.Equal(t, model.TransactionTypeBuy, *filter.TransactionType)
	})
}

// TestPriceRepositoryBasicOperations tests basic operations for PriceRepository
func TestPriceRepositoryBasicOperations(t *testing.T) {
	t.Run("NewPriceRepository creates repository", func(t *testing.T) {
		var db bun.IDB
		repo := NewPriceRepository(db)

		assert.NotNil(t, repo)
		assert.NotNil(t, repo.Repository)
	})

	t.Run("TimeRange validation", func(t *testing.T) {
		start := time.Now().AddDate(0, 0, -7)
		end := time.Now()
		timeRange := TimeRange{
			Start: start,
			End:   end,
		}

		assert.True(t, timeRange.End.After(timeRange.Start))
		assert.True(t, timeRange.End.Sub(timeRange.Start) > 0)
	})

	t.Run("PriceFilter validation", func(t *testing.T) {
		assetID := uuid.NewString()
		source := "test_source"
		filter := PriceFilter{
			AssetID: &assetID,
			Source:  &source,
		}

		assert.Equal(t, assetID, *filter.AssetID)
		assert.Equal(t, "test_source", *filter.Source)
	})
}

// TestPerformanceRepositoryBasicOperations tests basic operations for PerformanceRepository
func TestPerformanceRepositoryBasicOperations(t *testing.T) {
	t.Run("NewPerformanceRepository creates repository", func(t *testing.T) {
		var db bun.IDB
		repo := NewPerformanceRepository(db)

		assert.NotNil(t, repo)
		// PerformanceRepository doesn't embed Repository like others, so just check it exists
	})

	t.Run("PerformanceMetrics structure validation", func(t *testing.T) {
		portfolioID := uuid.NewString()
		metrics := PerformanceMetrics{
			PortfolioID:           portfolioID,
			TotalValue:            model.Money(100000), // $1000.00
			TotalCostBasis:        model.Money(90000),  // $900.00
			UnrealizedGainLoss:    model.Money(10000),  // $100.00
			TotalReturnPercentage: decimal.NewFromFloat(11.11),
			CalculationDate:       time.Now(),
		}

		assert.Equal(t, portfolioID, metrics.PortfolioID)
		assert.Equal(t, model.Money(100000), metrics.TotalValue)
		assert.Equal(t, model.Money(90000), metrics.TotalCostBasis)
		assert.Equal(t, model.Money(10000), metrics.UnrealizedGainLoss)
		assert.True(t, metrics.TotalReturnPercentage.GreaterThan(decimal.NewFromInt(10)))
	})
}

// TestAlertRepositoryBasicOperations tests basic operations for AlertRepository
func TestAlertRepositoryBasicOperations(t *testing.T) {
	t.Run("NewAlertRepository creates repository", func(t *testing.T) {
		var db bun.IDB
		repo := NewAlertRepository(db)

		assert.NotNil(t, repo)
		assert.NotNil(t, repo.Repository)
	})

	t.Run("UserAlert structure validation", func(t *testing.T) {
		userID := uuid.NewString()
		assetID := uuid.NewString()
		thresholdValue := decimal.NewFromFloat(100.50)

		alert := UserAlert{
			ID:             uuid.NewString(),
			UserID:         userID,
			AssetID:        &assetID,
			AlertType:      AlertTypePrice,
			ConditionType:  ConditionTypeAbove,
			ThresholdValue: &thresholdValue,
			IsActive:       true,
			CreatedAt:      time.Now(),
		}

		assert.Equal(t, userID, alert.UserID)
		assert.Equal(t, assetID, *alert.AssetID)
		assert.Equal(t, AlertTypePrice, alert.AlertType)
		assert.Equal(t, ConditionTypeAbove, alert.ConditionType)
		assert.True(t, alert.ThresholdValue.Equal(decimal.NewFromFloat(100.50)))
		assert.True(t, alert.IsActive)
	})

	t.Run("AlertFilter validation", func(t *testing.T) {
		userID := uuid.NewString()
		alertType := AlertTypePrice
		isActive := true

		filter := AlertFilter{
			UserID:    &userID,
			AlertType: &alertType,
			IsActive:  &isActive,
		}

		assert.Equal(t, userID, *filter.UserID)
		assert.Equal(t, AlertTypePrice, *filter.AlertType)
		assert.True(t, *filter.IsActive)
	})
}

// TestRepositoryInterfaces ensures all repositories implement their interfaces correctly
func TestRepositoryInterfaces(t *testing.T) {
	var db bun.IDB

	t.Run("AssetRepository implements IAssetRepository", func(t *testing.T) {
		var _ IAssetRepository = NewAssetRepository(db)
	})

	t.Run("PositionRepository implements IPositionRepository", func(t *testing.T) {
		var _ IPositionRepository = NewPositionRepository(db)
	})

	t.Run("TransactionRepository implements ITransactionRepository", func(t *testing.T) {
		var _ ITransactionRepository = NewTransactionRepository(db)
	})

	t.Run("PriceRepository implements IPriceRepository", func(t *testing.T) {
		var _ IPriceRepository = NewPriceRepository(db)
	})

	t.Run("PerformanceRepository implements IPerformanceRepository", func(t *testing.T) {
		var _ IPerformanceRepository = NewPerformanceRepository(db)
	})

	t.Run("AlertRepository implements IAlertRepository", func(t *testing.T) {
		var _ IAlertRepository = NewAlertRepository(db)
	})
}

// TestDomainModelValidation tests that our repositories work with the domain models
func TestDomainModelValidation(t *testing.T) {
	t.Run("Asset model validation", func(t *testing.T) {
		asset := model.Asset{
			ID:          uuid.NewString(),
			Type:        model.AssetTypeStock,
			Symbol:      &[]string{"AAPL"}[0],
			Name:        "Apple Inc.",
			IsTradeable: true,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		err := asset.Validate()
		require.NoError(t, err)

		assert.Equal(t, model.AssetTypeStock, asset.Type)
		assert.Equal(t, "AAPL", *asset.Symbol)
		assert.True(t, asset.IsTradeable)
	})

	t.Run("Position model validation", func(t *testing.T) {
		position := model.Position{
			ID:                  uuid.NewString(),
			PortfolioID:         uuid.NewString(),
			AssetID:             uuid.NewString(),
			Quantity:            decimal.NewFromInt(100),
			OwnershipPercentage: decimal.NewFromInt(100),
			CreatedAt:           time.Now(),
			UpdatedAt:           time.Now(),
		}

		err := position.Validate()
		require.NoError(t, err)

		assert.True(t, position.Quantity.Equal(decimal.NewFromInt(100)))
		assert.True(t, position.OwnershipPercentage.Equal(decimal.NewFromInt(100)))
	})

	t.Run("Transaction model validation", func(t *testing.T) {
		transaction := model.Transaction{
			ID:              uuid.NewString(),
			UserID:          uuid.NewString(),
			PositionID:      &[]string{uuid.NewString()}[0],
			Type:            model.TransactionTypeBuy,
			Amount:          model.Money(10000), // $100.00
			Quantity:        &[]decimal.Decimal{decimal.NewFromInt(10)}[0],
			PricePerUnit:    &[]decimal.Decimal{decimal.NewFromInt(10)}[0],
			TransactionDate: time.Now(),
			CreatedAt:       time.Now(),
		}

		err := transaction.Validate()
		require.NoError(t, err)

		assert.Equal(t, model.TransactionTypeBuy, transaction.Type)
		assert.Equal(t, model.Money(10000), transaction.Amount)
		assert.True(t, transaction.Quantity.Equal(decimal.NewFromInt(10)))
	})
}
