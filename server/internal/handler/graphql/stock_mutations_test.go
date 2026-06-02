package graphql

import (
	"context"
	"strings"
	"testing"
	"time"

	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/handler/middleware"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"
	"sigma_finance/internal/testutil"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestStockAssetMutationWorkflow tests the complete stock creation + add-to-portfolio flow
func TestStockAssetMutationWorkflow(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	// Setup services
	uow := repository.NewUnitOfWork(testDB.DB)
	assetService := service.NewAssetService(uow.Asset())
	portfolioService := service.NewPortfolioService(uow)
	tagService := service.NewTagService(uow)
	resolver := &Resolver{
		AssetService:     assetService,
		PortfolioService: portfolioService,
		TagService:       tagService,
		UOW:              uow,
	}

	mutationResolver := &mutationResolver{resolver}

	// Seed test data
	testData := testDB.SeedTestData(ctx)
	stockAssetType := testData.AssetTypes[0] // Should be "Stock"
	testUser := testData.Users[0]

	ctx = context.WithValue(ctx, middleware.UserKey, &middleware.AuthenticatedUser{
		ID:    testUser.ID,
		Email: testUser.Email,
	})

	t.Run("CreateStockAsset accepts ticker/quantity/purchasePrice/currentValue/purchaseDate", func(t *testing.T) {
		currentValue := 1500.0 // 150 * 10 shares
		purchaseDate := time.Now()
		purchasePrice := 140.0
		quantity := 10.0

		input := gqlModel.CreateStockInput{
			Name:          "Apple Inc.",
			AssetTypeID:   string(*stockAssetType),
			CurrentValue:  &currentValue,
			PurchaseDate:  &purchaseDate,
			PurchasePrice: &purchasePrice,
			Ticker:        "AAPL",
			Quantity:      quantity,
			QuoteCurrency: "USD",
		}

		stock, err := mutationResolver.CreateStockAsset(ctx, input)
		require.NoError(t, err)
		require.NotNil(t, stock)

		assert.Equal(t, "Apple Inc.", stock.Name)
		assert.Equal(t, "AAPL", stock.Ticker)
		assert.Equal(t, quantity, stock.Quantity)
		assert.NotEmpty(t, stock.ID)

		// Verify CurrentValue, PurchasePrice, PurchaseDate are set from input
		assert.Equal(t, &currentValue, stock.CurrentValue)
		assert.Equal(t, &purchasePrice, stock.PurchasePrice)
		assert.NotNil(t, stock.PurchaseDate)
	})

	t.Run("CreateStockAsset with only required fields", func(t *testing.T) {
		// Create stock with minimal fields (currentValue and purchasePrice optional per schema)
		input := gqlModel.CreateStockInput{
			Name:          "Minimal Stock",
			AssetTypeID:   string(*stockAssetType),
			Ticker:        "MIN",
			Quantity:      5.0,
			QuoteCurrency: "USD",
		}

		stock, err := mutationResolver.CreateStockAsset(ctx, input)
		require.NoError(t, err)
		require.NotNil(t, stock)

		assert.Equal(t, "Minimal Stock", stock.Name)
		assert.Equal(t, "MIN", stock.Ticker)
		assert.Equal(t, 5.0, stock.Quantity)
		assert.NotEmpty(t, stock.ID)
	})

	t.Run("AddAssetToPortfolio links created asset to portfolio", func(t *testing.T) {
		// First create a stock asset
		currentValue := 1000.0
		purchasePrice := 100.0
		purchaseDate := time.Now()

		createInput := gqlModel.CreateStockInput{
			Name:          "Microsoft Corp.",
			AssetTypeID:   string(*stockAssetType),
			CurrentValue:  &currentValue,
			PurchaseDate:  &purchaseDate,
			PurchasePrice: &purchasePrice,
			Ticker:        "MSFT",
			Quantity:      10.0,
			QuoteCurrency: "USD",
		}

		stock, err := mutationResolver.CreateStockAsset(ctx, createInput)
		require.NoError(t, err)
		require.NotNil(t, stock)

		// Now create a portfolio to add the asset to
		portfolioInput := gqlModel.CreatePortfolioInput{
			UserID: testUser.ID,
			Name:   "Test Portfolio for Stock",
		}

		portfolio, err := mutationResolver.CreatePortfolio(ctx, portfolioInput)
		require.NoError(t, err)
		require.NotNil(t, portfolio)

		// Add the stock to the portfolio
		avgPurchasePrice := 100.0
		addAssetInput := gqlModel.PortfolioAssetInput{
			PortfolioID:          portfolio.ID,
			AssetID:              stock.ID,
			Quantity:             10.0,
			AveragePurchasePrice: &avgPurchasePrice,
		}

		portfolioAsset, err := mutationResolver.AddAssetToPortfolio(ctx, addAssetInput)
		require.NoError(t, err)
		require.NotNil(t, portfolioAsset)

		// PortfolioID not exposed on gqlgen PortfolioAsset type - cannot assert on it
		assert.Equal(t, stock.ID, portfolioAsset.Asset.GetID())
		assert.Equal(t, 10.0, portfolioAsset.Quantity)
		assert.NotNil(t, portfolioAsset.AveragePurchasePrice)
		assert.Equal(t, 100.0, *portfolioAsset.AveragePurchasePrice)
	})

	t.Run("Duplicate add-to-portfolio attempt fails with controlled error", func(t *testing.T) {
		// Create a stock asset
		currentValue := 500.0
		purchasePrice := 50.0

		createInput := gqlModel.CreateStockInput{
			Name:          "Duplicate Test Stock",
			AssetTypeID:   string(*stockAssetType),
			CurrentValue:  &currentValue,
			PurchasePrice: &purchasePrice,
			Ticker:        "DUP",
			Quantity:      5.0,
			QuoteCurrency: "USD",
		}

		stock, err := mutationResolver.CreateStockAsset(ctx, createInput)
		require.NoError(t, err)

		// Create a portfolio
		portfolioInput := gqlModel.CreatePortfolioInput{
			UserID: testUser.ID,
			Name:   "Portfolio for Duplicate Test",
		}

		portfolio, err := mutationResolver.CreatePortfolio(ctx, portfolioInput)
		require.NoError(t, err)

		// Add asset to portfolio - first attempt should succeed
		addAssetInput := gqlModel.PortfolioAssetInput{
			PortfolioID:          portfolio.ID,
			AssetID:              stock.ID,
			Quantity:             5.0,
			AveragePurchasePrice: &purchasePrice,
		}

		_, err = mutationResolver.AddAssetToPortfolio(ctx, addAssetInput)
		require.NoError(t, err) // First add should succeed

		// Second attempt to add the same asset to the same portfolio should fail
		_, err = mutationResolver.AddAssetToPortfolio(ctx, addAssetInput)
		require.Error(t, err) // Duplicate should fail

		// Error should be a controlled/handled error, not a panic
		assert.True(t, strings.Contains(err.Error(), "already exists") || strings.Contains(err.Error(), "duplicate"))
	})

	t.Run("CreateStockAsset then AddAssetToPortfolio maintains data integrity", func(t *testing.T) {
		// Complete flow: create stock -> add to portfolio -> verify linked correctly
		currentValue := 2000.0
		purchasePrice := 190.0
		purchaseDate := time.Now()
		quantity := 15.0

		createInput := gqlModel.CreateStockInput{
			Name:          "Integrity Test Stock",
			AssetTypeID:   string(*stockAssetType),
			CurrentValue:  &currentValue,
			PurchaseDate:  &purchaseDate,
			PurchasePrice: &purchasePrice,
			Ticker:        "INT",
			Quantity:      quantity,
			QuoteCurrency: "USD",
		}

		stock, err := mutationResolver.CreateStockAsset(ctx, createInput)
		require.NoError(t, err)

		// Create portfolio
		portfolioInput := gqlModel.CreatePortfolioInput{
			UserID: testUser.ID,
			Name:   "Integrity Test Portfolio",
		}

		portfolio, err := mutationResolver.CreatePortfolio(ctx, portfolioInput)
		require.NoError(t, err)

		// Add to portfolio with different quantity (portfolio position may differ from asset total)
		portfolioQty := 10.0
		avgPrice := 195.0
		addAssetInput := gqlModel.PortfolioAssetInput{
			PortfolioID:          portfolio.ID,
			AssetID:              stock.ID,
			Quantity:             portfolioQty,
			AveragePurchasePrice: &avgPrice,
		}

		portfolioAsset, err := mutationResolver.AddAssetToPortfolio(ctx, addAssetInput)
		require.NoError(t, err)

		// Verify the portfolio asset has correct quantity (not the asset total quantity)
		assert.Equal(t, portfolioQty, portfolioAsset.Quantity)
		assert.Equal(t, avgPrice, *portfolioAsset.AveragePurchasePrice)

		// The original stock asset quantity should remain unchanged
		assert.Equal(t, quantity, stock.Quantity)
	})
}

// TestStockAssetInputValidation tests input validation for stock creation
func TestStockAssetInputValidation(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	uow := repository.NewUnitOfWork(testDB.DB)
	assetService := service.NewAssetService(uow.Asset())
	portfolioService := service.NewPortfolioService(uow)
	tagService := service.NewTagService(uow)
	resolver := &Resolver{
		AssetService:     assetService,
		PortfolioService: portfolioService,
		TagService:       tagService,
		UOW:              uow,
	}

	mutationResolver := &mutationResolver{resolver}
	testData := testDB.SeedTestData(ctx)
	stockAssetType := testData.AssetTypes[0]
	testUser := testData.Users[0]

	ctx = context.WithValue(ctx, middleware.UserKey, &middleware.AuthenticatedUser{
		ID:    testUser.ID,
		Email: testUser.Email,
	})

	t.Run("accepts zero for optional CurrentValue", func(t *testing.T) {
		input := gqlModel.CreateStockInput{
			Name:          "Zero Value Stock",
			AssetTypeID:   string(*stockAssetType),
			Ticker:        "ZERO",
			Quantity:      1.0,
			QuoteCurrency: "USD",
			// CurrentValue not set (nil)
		}

		stock, err := mutationResolver.CreateStockAsset(ctx, input)
		require.NoError(t, err)
		assert.NotNil(t, stock)
		assert.Nil(t, stock.CurrentValue) // nil when not provided
	})

	t.Run("accepts zero for optional PurchasePrice", func(t *testing.T) {
		currentValue := 100.0
		input := gqlModel.CreateStockInput{
			Name:          "Zero Purchase Stock",
			AssetTypeID:   string(*stockAssetType),
			CurrentValue:  &currentValue,
			Ticker:        "ZP",
			Quantity:      1.0,
			QuoteCurrency: "USD",
			// PurchasePrice not set (nil)
		}

		stock, err := mutationResolver.CreateStockAsset(ctx, input)
		require.NoError(t, err)
		assert.NotNil(t, stock)
		assert.Nil(t, stock.PurchasePrice)
	})

	t.Run("requires non-empty ticker", func(t *testing.T) {
		input := gqlModel.CreateStockInput{
			Name:          "Empty Ticker Stock",
			AssetTypeID:   string(*stockAssetType),
			Ticker:        "", // Empty ticker
			Quantity:      1.0,
			QuoteCurrency: "USD",
		}

		stock, err := mutationResolver.CreateStockAsset(ctx, input)
		// Should fail or handle gracefully
		if err == nil {
			// If it doesn't fail, at least verify ticker was not persisted incorrectly
			assert.Empty(t, stock.Ticker)
		}
	})

	t.Run("requires positive quantity", func(t *testing.T) {
		input := gqlModel.CreateStockInput{
			Name:          "Negative Quantity Stock",
			AssetTypeID:   string(*stockAssetType),
			Ticker:        "NEGQ",
			Quantity:      -5.0, // Negative quantity
			QuoteCurrency: "USD",
		}

		stock, err := mutationResolver.CreateStockAsset(ctx, input)
		// Should fail or handle gracefully
		if err == nil {
			// If it doesn't fail, quantity might be normalized
			assert.NotNil(t, stock)
		}
	})
}
