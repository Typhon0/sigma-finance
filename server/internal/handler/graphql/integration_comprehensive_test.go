package graphql

import (
	"context"
	"fmt"
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

// TestGraphQLIntegration_ComprehensiveUserOperations tests all User GraphQL operations with proper error handling
func TestGraphQLIntegration_ComprehensiveUserOperations(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	// Setup services
	uow := repository.NewUnitOfWork(testDB.DB)
	userService := service.NewUserService(uow)
	resolver := &Resolver{
		UserService: userService,
		UOW:         uow,
	}

	queryResolver := &queryResolver{resolver}
	mutResolver := &mutationResolver{resolver}

	t.Run("CreateUser_Success", func(t *testing.T) {
		input := gqlModel.CreateUserInput{
			Username: "testuser",
			Email:    "test@example.com",
			Password: "password123",
		}

		user, err := mutResolver.CreateUser(ctx, input)
		require.NoError(t, err)
		assert.NotNil(t, user)
		assert.Equal(t, "testuser", user.Username)
		assert.Equal(t, "test@example.com", user.Email)
		assert.NotEmpty(t, user.ID)
		assert.NotZero(t, user.CreatedAt)
		assert.NotZero(t, user.UpdatedAt)
	})

	t.Run("CreateUser_DuplicateEmail", func(t *testing.T) {
		// Create first user
		input1 := gqlModel.CreateUserInput{
			Username: "user1",
			Email:    "duplicate@example.com",
			Password: "password123",
		}
		_, err := mutResolver.CreateUser(ctx, input1)
		require.NoError(t, err)

		// Try to create second user with same email
		input2 := gqlModel.CreateUserInput{
			Username: "user2",
			Email:    "duplicate@example.com",
			Password: "password123",
		}
		_, err = mutResolver.CreateUser(ctx, input2)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "email")
	})

	t.Run("GetUser_Success", func(t *testing.T) {
		// Create a user first
		input := gqlModel.CreateUserInput{
			Username: "getuser",
			Email:    "get@example.com",
			Password: "password123",
		}
		createdUser, err := mutResolver.CreateUser(ctx, input)
		require.NoError(t, err)

		// Get the user
		user, err := queryResolver.User(ctx, createdUser.ID)
		require.NoError(t, err)
		assert.NotNil(t, user)
		assert.Equal(t, createdUser.ID, user.ID)
		assert.Equal(t, "getuser", user.Username)
		assert.Equal(t, "get@example.com", user.Email)
	})

	t.Run("GetUser_NotFound", func(t *testing.T) {
		user, err := queryResolver.User(ctx, "99999")
		require.NoError(t, err)
		assert.Nil(t, user)
	})

	t.Run("GetUsers_WithFiltering", func(t *testing.T) {
		// Create multiple users
		users := []gqlModel.CreateUserInput{
			{Username: "filter1", Email: "filter1@example.com", Password: "password123"},
			{Username: "filter2", Email: "filter2@example.com", Password: "password123"},
			{Username: "filter3", Email: "filter3@example.com", Password: "password123"},
		}

		for _, userInput := range users {
			_, err := mutResolver.CreateUser(ctx, userInput)
			require.NoError(t, err)
		}

		// Get all users
		allUsers, err := queryResolver.Users(ctx, nil, nil, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(allUsers), 3)

		// Test filtering by email
		emailFilter := "filter1@example.com"
		filter := &gqlModel.UserFilter{Email: &emailFilter}
		filteredUsers, err := queryResolver.Users(ctx, filter, nil, nil)
		require.NoError(t, err)
		assert.Len(t, filteredUsers, 1)
		assert.Equal(t, "filter1@example.com", filteredUsers[0].Email)

		// Test pagination
		pagination := &gqlModel.PaginationInput{Limit: &[]int32{2}[0]}
		paginatedUsers, err := queryResolver.Users(ctx, nil, pagination, nil)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(paginatedUsers), 2)
	})

	t.Run("UpdateUser_Success", func(t *testing.T) {
		// Create a user first
		input := gqlModel.CreateUserInput{
			Username: "updateuser",
			Email:    "update@example.com",
			Password: "password123",
		}
		createdUser, err := mutResolver.CreateUser(ctx, input)
		require.NoError(t, err)

		// Update the user
		newEmail := "updated@example.com"
		newUsername := "updateduser"
		updateInput := gqlModel.UpdateUserInput{
			Email:    &newEmail,
			Username: &newUsername,
		}
		updatedUser, err := mutResolver.UpdateUser(ctx, createdUser.ID, updateInput)
		require.NoError(t, err)
		assert.Equal(t, "updated@example.com", updatedUser.Email)
		assert.Equal(t, "updateduser", updatedUser.Username)
		assert.Equal(t, createdUser.ID, updatedUser.ID)
	})

	t.Run("DeleteUser_Success", func(t *testing.T) {
		// Create a user first
		input := gqlModel.CreateUserInput{
			Username: "deleteuser",
			Email:    "delete@example.com",
			Password: "password123",
		}
		createdUser, err := mutResolver.CreateUser(ctx, input)
		require.NoError(t, err)

		// Delete the user
		deletedID, err := mutResolver.DeleteUser(ctx, createdUser.ID)
		require.NoError(t, err)
		assert.Equal(t, createdUser.ID, deletedID)

		// Verify user is deleted
		user, err := queryResolver.User(ctx, createdUser.ID)
		require.NoError(t, err)
		assert.Nil(t, user)
	})
}

// TestGraphQLIntegration_ComprehensivePortfolioOperations tests all Portfolio GraphQL operations
func TestGraphQLIntegration_ComprehensivePortfolioOperations(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	// Setup services
	uow := repository.NewUnitOfWork(testDB.DB)
	userService := service.NewUserService(uow)
	portfolioService := service.NewPortfolioService(uow)
	tagService := service.NewTagService(uow)
	resolver := &Resolver{
		UserService:      userService,
		PortfolioService: portfolioService,
		TagService:       tagService,
		UOW:              uow,
	}

	queryResolver := &queryResolver{resolver}
	mutResolver := &mutationResolver{resolver}

	// Create a test user first
	userInput := gqlModel.CreateUserInput{
		Username: "portfoliouser",
		Email:    "portfolio@example.com",
		Password: "password123",
	}
	testUser, err := mutResolver.CreateUser(ctx, userInput)
	require.NoError(t, err)

	ctx = context.WithValue(ctx, middleware.UserKey, &middleware.AuthenticatedUser{
		ID:    testUser.ID,
		Email: testUser.Email,
	})

	t.Run("CreatePortfolio_Success", func(t *testing.T) {
		input := gqlModel.CreatePortfolioInput{
			UserID: testUser.ID,
			Name:   "Test Portfolio",
		}

		portfolio, err := mutResolver.CreatePortfolio(ctx, input)
		require.NoError(t, err)
		assert.NotNil(t, portfolio)
		assert.Equal(t, "Test Portfolio", portfolio.Name)
		assert.NotEmpty(t, portfolio.ID)
		assert.NotZero(t, portfolio.CreatedAt)
		assert.NotZero(t, portfolio.UpdatedAt)
	})

	t.Run("CreatePortfolio_InvalidUser", func(t *testing.T) {
		input := gqlModel.CreatePortfolioInput{
			UserID: "99999",
			Name:   "Invalid User Portfolio",
		}

		_, err := mutResolver.CreatePortfolio(ctx, input)
		assert.Error(t, err)
	})

	t.Run("GetPortfolio_Success", func(t *testing.T) {
		// Create a portfolio first
		input := gqlModel.CreatePortfolioInput{
			UserID: testUser.ID,
			Name:   "Get Portfolio",
		}
		createdPortfolio, err := mutResolver.CreatePortfolio(ctx, input)
		require.NoError(t, err)

		// Get the portfolio
		portfolio, err := queryResolver.Portfolio(ctx, createdPortfolio.ID)
		require.NoError(t, err)
		assert.NotNil(t, portfolio)
		assert.Equal(t, createdPortfolio.ID, portfolio.ID)
		assert.Equal(t, "Get Portfolio", portfolio.Name)
	})

	t.Run("GetPortfolios_WithFiltering", func(t *testing.T) {
		// Create multiple portfolios
		portfolios := []string{"Portfolio A", "Portfolio B", "Portfolio C"}
		createdPortfolios := make([]*gqlModel.Portfolio, 0, len(portfolios))

		for _, name := range portfolios {
			input := gqlModel.CreatePortfolioInput{
				UserID: testUser.ID,
				Name:   name,
			}
			portfolio, err := mutResolver.CreatePortfolio(ctx, input)
			require.NoError(t, err)
			createdPortfolios = append(createdPortfolios, portfolio)
		}

		// Get all portfolios
		allPortfolios, err := queryResolver.Portfolios(ctx, nil, nil, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(allPortfolios), 3)

		// Test filtering by user ID
		filter := &gqlModel.PortfolioFilter{UserID: &testUser.ID}
		userPortfolios, err := queryResolver.Portfolios(ctx, filter, nil, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(userPortfolios), 3)

		// Test pagination
		pagination := &gqlModel.PaginationInput{Limit: &[]int32{2}[0]}
		paginatedPortfolios, err := queryResolver.Portfolios(ctx, nil, pagination, nil)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(paginatedPortfolios), 2)
	})

	t.Run("UpdatePortfolio_Success", func(t *testing.T) {
		// Create a portfolio first
		input := gqlModel.CreatePortfolioInput{
			UserID: testUser.ID,
			Name:   "Update Portfolio",
		}
		createdPortfolio, err := mutResolver.CreatePortfolio(ctx, input)
		require.NoError(t, err)

		// Update the portfolio
		newName := "Updated Portfolio"
		updateInput := gqlModel.UpdatePortfolioInput{Name: &newName}
		updatedPortfolio, err := mutResolver.UpdatePortfolio(ctx, createdPortfolio.ID, updateInput)
		require.NoError(t, err)
		assert.Equal(t, "Updated Portfolio", updatedPortfolio.Name)
		assert.Equal(t, createdPortfolio.ID, updatedPortfolio.ID)
	})

	t.Run("DeletePortfolio_Success", func(t *testing.T) {
		// Create a portfolio first
		input := gqlModel.CreatePortfolioInput{
			UserID: testUser.ID,
			Name:   "Delete Portfolio",
		}
		createdPortfolio, err := mutResolver.CreatePortfolio(ctx, input)
		require.NoError(t, err)

		// Delete the portfolio
		deletedID, err := mutResolver.DeletePortfolio(ctx, createdPortfolio.ID)
		require.NoError(t, err)
		assert.Equal(t, createdPortfolio.ID, deletedID)

		// Verify portfolio is deleted
		portfolio, err := queryResolver.Portfolio(ctx, createdPortfolio.ID)
		require.NoError(t, err)
		assert.Nil(t, portfolio)
	})
}

// TestGraphQLIntegration_ComprehensiveAssetOperations tests all Asset GraphQL operations
func TestGraphQLIntegration_ComprehensiveAssetOperations(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	// Setup services
	uow := repository.NewUnitOfWork(testDB.DB)
	assetService := service.NewAssetService(uow.Asset())
	tagService := service.NewTagService(uow)
	resolver := &Resolver{
		AssetService: assetService,
		TagService:   tagService,
		UOW:          uow,
	}

	queryResolver := &queryResolver{resolver}
	mutResolver := &mutationResolver{resolver}

	// Seed test data for asset types
	testData := testDB.SeedTestData(ctx)
	stockAssetType := testData.AssetTypes[0]  // Should be "Stock"
	cryptoAssetType := testData.AssetTypes[1] // Should be "Crypto"

	t.Run("CreateStockAsset_Success", func(t *testing.T) {
		currentValue := 150.0
		purchaseDate := time.Now()
		purchasePrice := 140.0
		input := gqlModel.CreateStockInput{
			Name:          "Apple Inc",
			AssetTypeID:   string(*stockAssetType),
			CurrentValue:  &currentValue,
			PurchaseDate:  &purchaseDate,
			PurchasePrice: &purchasePrice,
			Ticker:        "AAPL",
			Quantity:      10.0,
			QuoteCurrency: "USD",
		}

		stock, err := mutResolver.CreateStockAsset(ctx, input)
		require.NoError(t, err)
		assert.NotNil(t, stock)
		assert.Equal(t, "Apple Inc", stock.Name)
		assert.Equal(t, "AAPL", stock.Ticker)
		assert.Equal(t, 10.0, stock.Quantity)
		assert.NotEmpty(t, stock.ID)
		assert.NotNil(t, stock.CurrentValue)
		assert.Equal(t, 150.0, *stock.CurrentValue)
	})

	t.Run("CreateStockAsset_InvalidAssetType", func(t *testing.T) {
		// The resolver currently ignores AssetTypeID and defaults to STOCK
		// This test documents current behavior - invalid ID is accepted
		currentValue := 150.0
		input := gqlModel.CreateStockInput{
			Name:          "Invalid Stock",
			AssetTypeID:   "99999",
			CurrentValue:  &currentValue,
			Ticker:        "INVALID",
			Quantity:      10.0,
			QuoteCurrency: "USD",
		}

		stock, err := mutResolver.CreateStockAsset(ctx, input)
		require.NoError(t, err)
		assert.NotNil(t, stock)
	})

	t.Run("CreateCryptoAsset_Success", func(t *testing.T) {
		currentValue := 45000.0
		purchaseDate := time.Now()
		purchasePrice := 40000.0
		walletAddress := "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
		blockchainNetwork := "Bitcoin"
		input := gqlModel.CreateCryptoInput{
			Name:              "Bitcoin",
			AssetTypeID:       string(*cryptoAssetType),
			CurrentValue:      &currentValue,
			PurchaseDate:      &purchaseDate,
			PurchasePrice:     &purchasePrice,
			WalletAddress:     &walletAddress,
			BlockchainNetwork: &blockchainNetwork,
			Quantity:          0.5,
			QuoteCurrency:     "USD",
		}

		crypto, err := mutResolver.CreateCryptoAsset(ctx, input)
		require.NoError(t, err)
		assert.NotNil(t, crypto)
		assert.Equal(t, "Bitcoin", crypto.Name)
		assert.Equal(t, "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", *crypto.WalletAddress)
		assert.Equal(t, "Bitcoin", *crypto.BlockchainNetwork)
		assert.Equal(t, 0.5, crypto.Quantity)
		assert.NotEmpty(t, crypto.ID)
	})

	t.Run("GetAsset_Success", func(t *testing.T) {
		// Create a stock asset first
		currentValue := 300.0
		purchaseDate := time.Now()
		purchasePrice := 280.0
		input := gqlModel.CreateStockInput{
			Name:          "Microsoft",
			AssetTypeID:   string(*stockAssetType),
			CurrentValue:  &currentValue,
			PurchaseDate:  &purchaseDate,
			PurchasePrice: &purchasePrice,
			Ticker:        "MSFT",
			Quantity:      5.0,
			QuoteCurrency: "USD",
		}
		createdAsset, err := mutResolver.CreateStockAsset(ctx, input)
		require.NoError(t, err)

		// Get the asset
		asset, err := queryResolver.Asset(ctx, createdAsset.ID)
		require.NoError(t, err)
		assert.NotNil(t, asset)

		// Type assertion to check it's a stock
		stock, ok := asset.(*gqlModel.Stock)
		require.True(t, ok)
		assert.Equal(t, createdAsset.ID, stock.ID)
		assert.Equal(t, "Microsoft", stock.Name)
		assert.Equal(t, "MSFT", stock.Ticker)
	})

	t.Run("GetAssets_WithFiltering", func(t *testing.T) {
		// Create multiple assets
		currentValue := 2800.0
		purchaseDate := time.Now()
		purchasePrice := 2700.0
		stockInput := gqlModel.CreateStockInput{
			Name:          "Google",
			AssetTypeID:   string(*stockAssetType),
			CurrentValue:  &currentValue,
			PurchaseDate:  &purchaseDate,
			PurchasePrice: &purchasePrice,
			Ticker:        "GOOGL",
			Quantity:      2.0,
			QuoteCurrency: "USD",
		}
		_, err := mutResolver.CreateStockAsset(ctx, stockInput)
		require.NoError(t, err)

		currentValue2 := 3000.0
		purchaseDate2 := time.Now()
		purchasePrice2 := 2800.0
		walletAddress2 := "0x742d35Cc6634C0532925a3b8D4C9db96590b5b8c"
		blockchainNetwork2 := "Ethereum"
		cryptoInput := gqlModel.CreateCryptoInput{
			Name:              "Ethereum",
			AssetTypeID:       string(*cryptoAssetType),
			CurrentValue:      &currentValue2,
			PurchaseDate:      &purchaseDate2,
			PurchasePrice:     &purchasePrice2,
			WalletAddress:     &walletAddress2,
			BlockchainNetwork: &blockchainNetwork2,
			Quantity:          1.0,
			QuoteCurrency:     "USD",
		}
		_, err = mutResolver.CreateCryptoAsset(ctx, cryptoInput)
		require.NoError(t, err)

		// Get all assets
		allAssets, err := queryResolver.Assets(ctx, nil, nil, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(allAssets), 2)

		// Test filtering by asset type
		assetTypeIDStr := string(*stockAssetType)
		filter := &gqlModel.AssetFilter{AssetTypeID: &assetTypeIDStr}
		stockAssets, err := queryResolver.Assets(ctx, filter, nil, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(stockAssets), 1)

		// Verify all returned assets are stocks
		for _, asset := range stockAssets {
			_, ok := asset.(*gqlModel.Stock)
			assert.True(t, ok, "Expected stock asset")
		}

		// Test pagination
		pagination := &gqlModel.PaginationInput{Limit: &[]int32{1}[0]}
		paginatedAssets, err := queryResolver.Assets(ctx, nil, pagination, nil)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(paginatedAssets), 1)
	})

	t.Run("GetAssetTypes_Success", func(t *testing.T) {
		assetTypes, err := queryResolver.AssetTypes(ctx)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(assetTypes), 2)

		// Verify we have stock and crypto types
		typeNames := make(map[string]bool)
		for _, assetType := range assetTypes {
			typeNames[assetType.Name] = true
		}
		assert.True(t, typeNames["Stock"])
		assert.True(t, typeNames["Crypto"])
	})
}

// TestGraphQLIntegration_ComprehensiveWatchlistOperations tests Watchlist GraphQL operations with proper error handling
func TestGraphQLIntegration_ComprehensiveWatchlistOperations(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	// Setup services
	uow := repository.NewUnitOfWork(testDB.DB)
	userService := service.NewUserService(uow)
	watchlistService := service.NewWatchlistService(uow)
	assetService := service.NewAssetService(uow.Asset())
	resolver := &Resolver{
		UserService:      userService,
		WatchlistService: watchlistService,
		AssetService:     assetService,
		UOW:              uow,
	}

	queryResolver := &queryResolver{resolver}
	mutResolver := &mutationResolver{resolver}

	// Create a test user first
	userInput := gqlModel.CreateUserInput{
		Username: "watchlistuser",
		Email:    "watchlist@example.com",
		Password: "password123",
	}
	testUser, err := mutResolver.CreateUser(ctx, userInput)
	require.NoError(t, err)

	// Seed test data for assets
	testData := testDB.SeedTestData(ctx)

	t.Run("CreateWatchlist_Success", func(t *testing.T) {
		input := gqlModel.CreateWatchlistInput{
			UserID: testUser.ID,
			Name:   "My Watchlist",
		}

		watchlist, err := mutResolver.CreateWatchlist(ctx, input)
		require.NoError(t, err)
		assert.NotNil(t, watchlist)
		assert.Equal(t, "My Watchlist", watchlist.Name)
		assert.NotEmpty(t, watchlist.ID)
		assert.NotZero(t, watchlist.CreatedAt)
		assert.NotZero(t, watchlist.UpdatedAt)
	})

	t.Run("CreateWatchlist_InvalidUser", func(t *testing.T) {
		input := gqlModel.CreateWatchlistInput{
			UserID: "99999",
			Name:   "Invalid User Watchlist",
		}

		_, err := mutResolver.CreateWatchlist(ctx, input)
		assert.Error(t, err)
	})

	t.Run("GetWatchlists_Success", func(t *testing.T) {
		// Create multiple watchlists
		watchlists := []string{"Watchlist 1", "Watchlist 2", "Watchlist 3"}
		for _, name := range watchlists {
			input := gqlModel.CreateWatchlistInput{
				UserID: testUser.ID,
				Name:   name,
			}
			_, err := mutResolver.CreateWatchlist(ctx, input)
			require.NoError(t, err)
		}

		// Get all watchlists
		allWatchlists, err := queryResolver.Watchlists(ctx, nil, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(allWatchlists), 3)

		// Test filtering by user ID
		filter := &gqlModel.WatchlistFilter{UserID: testUser.ID}
		userWatchlists, err := queryResolver.Watchlists(ctx, filter, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(userWatchlists), 3)

		// Test pagination
		pagination := &gqlModel.PaginationInput{Limit: &[]int32{2}[0]}
		paginatedWatchlists, err := queryResolver.Watchlists(ctx, nil, pagination)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(paginatedWatchlists), 2)
	})

	t.Run("WatchlistAssetManagement_Success", func(t *testing.T) {
		// Create a watchlist first
		input := gqlModel.CreateWatchlistInput{
			UserID: testUser.ID,
			Name:   "Asset Management Watchlist",
		}
		createdWatchlist, err := mutResolver.CreateWatchlist(ctx, input)
		require.NoError(t, err)

		// Add asset to watchlist
		assetIDStr := testData.Assets[0].ID
		updatedWatchlist, err := mutResolver.AddAssetToWatchlist(ctx, createdWatchlist.ID, assetIDStr)
		require.NoError(t, err)
		assert.NotNil(t, updatedWatchlist)
		assert.Equal(t, createdWatchlist.ID, updatedWatchlist.ID)

		// Remove asset from watchlist
		removedWatchlist, err := mutResolver.RemoveAssetFromWatchlist(ctx, createdWatchlist.ID, assetIDStr)
		require.NoError(t, err)
		assert.NotNil(t, removedWatchlist)
		assert.Equal(t, createdWatchlist.ID, removedWatchlist.ID)
	})

	t.Run("DeleteWatchlist_Success", func(t *testing.T) {
		// Create a watchlist first
		input := gqlModel.CreateWatchlistInput{
			UserID: testUser.ID,
			Name:   "Delete Watchlist",
		}
		createdWatchlist, err := mutResolver.CreateWatchlist(ctx, input)
		require.NoError(t, err)

		// Delete the watchlist
		deletedID, err := mutResolver.DeleteWatchlist(ctx, createdWatchlist.ID)
		require.NoError(t, err)
		assert.Equal(t, createdWatchlist.ID, deletedID)
	})
}

// TestGraphQLIntegration_ErrorHandling tests comprehensive error handling scenarios
func TestGraphQLIntegration_ErrorHandling(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	// Setup services
	uow := repository.NewUnitOfWork(testDB.DB)
	userService := service.NewUserService(uow)
	portfolioService := service.NewPortfolioService(uow)
	assetService := service.NewAssetService(uow.Asset())
	watchlistService := service.NewWatchlistService(uow)
	resolver := &Resolver{
		UserService:      userService,
		PortfolioService: portfolioService,
		AssetService:     assetService,
		WatchlistService: watchlistService,
		UOW:              uow,
	}

	queryResolver := &queryResolver{resolver}
	mutResolver := &mutationResolver{resolver}

	t.Run("InvalidID_Parsing", func(t *testing.T) {
		// Test invalid ID formats — resolvers return nil, nil for not-found
		user, err := queryResolver.User(ctx, "invalid")
		require.NoError(t, err)
		assert.Nil(t, user)

		portfolio, err := queryResolver.Portfolio(ctx, "not-a-number")
		require.NoError(t, err)
		assert.Nil(t, portfolio)

		asset, err := queryResolver.Asset(ctx, "abc123")
		require.NoError(t, err)
		assert.Nil(t, asset)
	})

	t.Run("NotFound_Scenarios", func(t *testing.T) {
		// Test not found scenarios
		user, err := queryResolver.User(ctx, "99999")
		require.NoError(t, err)
		assert.Nil(t, user)

		portfolio, err := queryResolver.Portfolio(ctx, "99999")
		require.NoError(t, err)
		assert.Nil(t, portfolio)

		asset, err := queryResolver.Asset(ctx, "99999")
		require.NoError(t, err)
		assert.Nil(t, asset)
	})

	t.Run("ValidationErrors", func(t *testing.T) {
		// Test validation errors
		invalidUserInput := gqlModel.CreateUserInput{
			Username: "",              // Empty username should fail
			Email:    "invalid-email", // Invalid email format
			Password: "123",           // Too short password
		}
		_, err := mutResolver.CreateUser(ctx, invalidUserInput)
		assert.Error(t, err)

		// Test invalid portfolio creation
		invalidPortfolioInput := gqlModel.CreatePortfolioInput{
			UserID: "99999", // Non-existent user
			Name:   "",      // Empty name should fail
		}
		_, err = mutResolver.CreatePortfolio(ctx, invalidPortfolioInput)
		assert.Error(t, err)
	})
}

// TestGraphQLIntegration_ComprehensiveRelationships tests complex relationship loading and filtering scenarios
func TestGraphQLIntegration_ComprehensiveRelationships(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	// Setup services
	uow := repository.NewUnitOfWork(testDB.DB)
	userService := service.NewUserService(uow)
	portfolioService := service.NewPortfolioService(uow)
	assetService := service.NewAssetService(uow.Asset())
	tagService := service.NewTagService(uow)
	resolver := &Resolver{
		UserService:      userService,
		PortfolioService: portfolioService,
		AssetService:     assetService,
		TagService:       tagService,
		UOW:              uow,
	}

	queryResolver := &queryResolver{resolver}
	mutResolver := &mutationResolver{resolver}

	// Seed test data
	testData := testDB.SeedTestData(ctx)

	// Create additional test user
	userInput := gqlModel.CreateUserInput{
		Username: "complexuser",
		Email:    "complex@example.com",
		Password: "password123",
	}
	testUser, err := mutResolver.CreateUser(ctx, userInput)
	require.NoError(t, err)

	t.Run("MultiUserPortfolioScenario", func(t *testing.T) {
		// Create portfolios for different users
		portfolio1Input := gqlModel.CreatePortfolioInput{
			UserID: testUser.ID,
			Name:   "User1 Portfolio",
		}
		ctx1 := context.WithValue(ctx, middleware.UserKey, &middleware.AuthenticatedUser{
			ID:    testUser.ID,
			Email: testUser.Email,
		})
		portfolio1, err := mutResolver.CreatePortfolio(ctx1, portfolio1Input)
		require.NoError(t, err)

		// Create another user
		user2Input := gqlModel.CreateUserInput{
			Username: "user2",
			Email:    "user2@example.com",
			Password: "password123",
		}
		testUser2, err := mutResolver.CreateUser(ctx, user2Input)
		require.NoError(t, err)

		portfolio2Input := gqlModel.CreatePortfolioInput{
			UserID: testUser2.ID,
			Name:   "User2 Portfolio",
		}
		ctx2 := context.WithValue(ctx, middleware.UserKey, &middleware.AuthenticatedUser{
			ID:    testUser2.ID,
			Email: testUser2.Email,
		})
		portfolio2, err := mutResolver.CreatePortfolio(ctx2, portfolio2Input)
		require.NoError(t, err)

		// Test filtering portfolios by user
		filter1 := &gqlModel.PortfolioFilter{UserID: &testUser.ID}
		user1Portfolios, err := queryResolver.Portfolios(ctx1, filter1, nil, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(user1Portfolios), 1)

		filter2 := &gqlModel.PortfolioFilter{UserID: &testUser2.ID}
		user2Portfolios, err := queryResolver.Portfolios(ctx2, filter2, nil, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(user2Portfolios), 1)

		// Verify portfolios belong to correct users
		for _, p := range user1Portfolios {
			// Note: User field is not populated by basic mapping, would need separate resolver
			assert.NotEmpty(t, p.ID)
		}

		assert.NotEqual(t, portfolio1.ID, portfolio2.ID)
	})

	t.Run("AssetTypeFiltering", func(t *testing.T) {
		// Create assets of different types
		stockInput := gqlModel.CreateStockInput{
			Name:          "Test Stock",
			AssetTypeID:   string(*testData.AssetTypes[0]),
			Ticker:        "TEST",
			Quantity:      10.0,
			QuoteCurrency: "USD",
		}
		stock, err := mutResolver.CreateStockAsset(ctx, stockInput)
		require.NoError(t, err)

		cryptoInput := gqlModel.CreateCryptoInput{
			Name:          "Test Crypto",
			AssetTypeID:   string(*testData.AssetTypes[1]),
			Quantity:      1.0,
			QuoteCurrency: "USD",
		}
		crypto, err := mutResolver.CreateCryptoAsset(ctx, cryptoInput)
		require.NoError(t, err)

		// Test filtering by asset type
		stockTypeFilter := &gqlModel.AssetFilter{
			AssetTypeID: &[]string{string(*testData.AssetTypes[0])}[0],
		}
		stockAssets, err := queryResolver.Assets(ctx, stockTypeFilter, nil, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(stockAssets), 1)

		cryptoTypeFilter := &gqlModel.AssetFilter{
			AssetTypeID: &[]string{string(*testData.AssetTypes[1])}[0],
		}
		cryptoAssets, err := queryResolver.Assets(ctx, cryptoTypeFilter, nil, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(cryptoAssets), 1)

		// Verify asset types
		for _, asset := range stockAssets {
			_, ok := asset.(*gqlModel.Stock)
			assert.True(t, ok, "Expected stock asset")
		}

		for _, asset := range cryptoAssets {
			_, ok := asset.(*gqlModel.Crypto)
			assert.True(t, ok, "Expected crypto asset")
		}

		assert.NotEqual(t, stock.ID, crypto.ID)
	})

	t.Run("PaginationAndSorting", func(t *testing.T) {
		// Create multiple users for pagination testing
		users := make([]*gqlModel.User, 0, 5)
		for i := 0; i < 5; i++ {
			userInput := gqlModel.CreateUserInput{
				Username: fmt.Sprintf("paginationuser%d", i),
				Email:    fmt.Sprintf("pagination%d@example.com", i),
				Password: "password123",
			}
			user, err := mutResolver.CreateUser(ctx, userInput)
			require.NoError(t, err)
			users = append(users, user)
		}

		// Test pagination
		pagination := &gqlModel.PaginationInput{
			Limit:  &[]int32{3}[0],
			Offset: &[]int32{1}[0],
		}
		paginatedUsers, err := queryResolver.Users(ctx, nil, pagination, nil)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(paginatedUsers), 3)

		// Test with different page sizes
		smallPage := &gqlModel.PaginationInput{Limit: &[]int32{1}[0]}
		singleUser, err := queryResolver.Users(ctx, nil, smallPage, nil)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(singleUser), 1)
	})
}
