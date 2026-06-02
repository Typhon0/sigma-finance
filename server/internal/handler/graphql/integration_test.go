package graphql

import (
	"context"
	"fmt"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/handler/middleware"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"
	"sigma_finance/internal/testutil"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGraphQLIntegration_UserOperations tests all User GraphQL operations
func TestGraphQLIntegration_UserOperations(t *testing.T) {
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
	mutationResolver := &mutationResolver{resolver}

	t.Run("CreateUser", func(t *testing.T) {
		input := gqlModel.CreateUserInput{
			Username: "testuser",
			Email:    "test@example.com",
			Password: "password123",
		}

		user, err := mutationResolver.CreateUser(ctx, input)
		require.NoError(t, err)
		assert.NotNil(t, user)
		assert.Equal(t, "testuser", user.Username)
		assert.Equal(t, "test@example.com", user.Email)
		assert.NotEmpty(t, user.ID)
	})

	t.Run("GetUser", func(t *testing.T) {
		// Create a user first
		input := gqlModel.CreateUserInput{
			Username: "getuser",
			Email:    "get@example.com",
			Password: "password123",
		}
		createdUser, err := mutationResolver.CreateUser(ctx, input)
		require.NoError(t, err)

		// Get the user
		user, err := queryResolver.User(ctx, createdUser.ID)
		require.NoError(t, err)
		assert.NotNil(t, user)
		assert.Equal(t, createdUser.ID, user.ID)
		assert.Equal(t, "getuser", user.Username)
	})

	t.Run("GetUsers", func(t *testing.T) {
		// Create multiple users
		users := []gqlModel.CreateUserInput{
			{Username: "user1", Email: "user1@example.com", Password: "password123"},
			{Username: "user2", Email: "user2@example.com", Password: "password123"},
		}

		for _, userInput := range users {
			_, err := mutationResolver.CreateUser(ctx, userInput)
			require.NoError(t, err)
		}

		// Get all users
		allUsers, err := queryResolver.Users(ctx, nil, nil, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(allUsers), 2)

		// Test filtering by email
		emailFilter := "user1@example.com"
		filter := &gqlModel.UserFilter{Email: &emailFilter}
		filteredUsers, err := queryResolver.Users(ctx, filter, nil, nil)
		require.NoError(t, err)
		assert.Len(t, filteredUsers, 1)
		assert.Equal(t, "user1@example.com", filteredUsers[0].Email)

		// Test pagination
		pagination := &gqlModel.PaginationInput{Limit: &[]int32{1}[0]}
		paginatedUsers, err := queryResolver.Users(ctx, nil, pagination, nil)
		require.NoError(t, err)
		assert.Len(t, paginatedUsers, 1)
	})

	t.Run("UpdateUser", func(t *testing.T) {
		// Create a user first
		input := gqlModel.CreateUserInput{
			Username: "updateuser",
			Email:    "update@example.com",
			Password: "password123",
		}
		createdUser, err := mutationResolver.CreateUser(ctx, input)
		require.NoError(t, err)

		// Update the user
		newEmail := "updated@example.com"
		updateInput := gqlModel.UpdateUserInput{Email: &newEmail}
		updatedUser, err := mutationResolver.UpdateUser(ctx, createdUser.ID, updateInput)
		require.NoError(t, err)
		assert.Equal(t, "updated@example.com", updatedUser.Email)
	})

	t.Run("DeleteUser", func(t *testing.T) {
		// Create a user first
		input := gqlModel.CreateUserInput{
			Username: "deleteuser",
			Email:    "delete@example.com",
			Password: "password123",
		}
		createdUser, err := mutationResolver.CreateUser(ctx, input)
		require.NoError(t, err)

		// Delete the user
		deletedID, err := mutationResolver.DeleteUser(ctx, createdUser.ID)
		require.NoError(t, err)
		assert.Equal(t, createdUser.ID, deletedID)

		// Verify user is deleted
		user, err := queryResolver.User(ctx, createdUser.ID)
		require.NoError(t, err)
		assert.Nil(t, user)
	})
}

// TestGraphQLIntegration_PortfolioOperations tests all Portfolio GraphQL operations
func TestGraphQLIntegration_PortfolioOperations(t *testing.T) {
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
	mutationResolver := &mutationResolver{resolver}

	// Create a test user first
	userInput := gqlModel.CreateUserInput{
		Username: "portfoliouser",
		Email:    "portfolio@example.com",
		Password: "password123",
	}
	testUser, err := mutationResolver.CreateUser(ctx, userInput)
	require.NoError(t, err)

	ctx = context.WithValue(ctx, middleware.UserKey, &middleware.AuthenticatedUser{
		ID:    testUser.ID,
		Email: testUser.Email,
	})

	t.Run("CreatePortfolio", func(t *testing.T) {
		input := gqlModel.CreatePortfolioInput{
			UserID: testUser.ID,
			Name:   "Test Portfolio",
		}

		portfolio, err := mutationResolver.CreatePortfolio(ctx, input)
		require.NoError(t, err)
		assert.NotNil(t, portfolio)
		assert.Equal(t, "Test Portfolio", portfolio.Name)
		// User field is not populated by the basic mutation, so it will be nil here
		assert.NotEmpty(t, portfolio.ID)
	})

	t.Run("GetPortfolio", func(t *testing.T) {
		// Create a portfolio first
		input := gqlModel.CreatePortfolioInput{
			UserID: testUser.ID,
			Name:   "Get Portfolio",
		}
		createdPortfolio, err := mutationResolver.CreatePortfolio(ctx, input)
		require.NoError(t, err)

		// Get the portfolio
		portfolio, err := queryResolver.Portfolio(ctx, createdPortfolio.ID)
		require.NoError(t, err)
		assert.NotNil(t, portfolio)
		assert.Equal(t, createdPortfolio.ID, portfolio.ID)
		assert.Equal(t, "Get Portfolio", portfolio.Name)
	})

	t.Run("GetPortfolios", func(t *testing.T) {
		// Create multiple portfolios
		portfolios := []string{"Portfolio 1", "Portfolio 2"}
		for _, name := range portfolios {
			input := gqlModel.CreatePortfolioInput{
				UserID: testUser.ID,
				Name:   name,
			}
			_, err := mutationResolver.CreatePortfolio(ctx, input)
			require.NoError(t, err)
		}

		// Get all portfolios
		allPortfolios, err := queryResolver.Portfolios(ctx, nil, nil, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(allPortfolios), 2)

		// Test filtering by user ID
		filter := &gqlModel.PortfolioFilter{UserID: &testUser.ID}
		userPortfolios, err := queryResolver.Portfolios(ctx, filter, nil, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(userPortfolios), 2)
		// Note: User field is not populated by the basic mapPortfoliosToGQL function
		// This would require a separate resolver or eager loading to populate User field

		// Test pagination
		pagination := &gqlModel.PaginationInput{Limit: &[]int32{1}[0]}
		paginatedPortfolios, err := queryResolver.Portfolios(ctx, nil, pagination, nil)
		require.NoError(t, err)
		assert.Len(t, paginatedPortfolios, 1)
	})

	t.Run("UpdatePortfolio", func(t *testing.T) {
		// Create a portfolio first
		input := gqlModel.CreatePortfolioInput{
			UserID: testUser.ID,
			Name:   "Update Portfolio",
		}
		createdPortfolio, err := mutationResolver.CreatePortfolio(ctx, input)
		require.NoError(t, err)

		// Update the portfolio
		newName := "Updated Portfolio"
		updateInput := gqlModel.UpdatePortfolioInput{Name: &newName}
		updatedPortfolio, err := mutationResolver.UpdatePortfolio(ctx, createdPortfolio.ID, updateInput)
		require.NoError(t, err)
		assert.Equal(t, "Updated Portfolio", updatedPortfolio.Name)
	})

	t.Run("DeletePortfolio", func(t *testing.T) {
		// Create a portfolio first
		input := gqlModel.CreatePortfolioInput{
			UserID: testUser.ID,
			Name:   "Delete Portfolio",
		}
		createdPortfolio, err := mutationResolver.CreatePortfolio(ctx, input)
		require.NoError(t, err)

		// Delete the portfolio
		deletedID, err := mutationResolver.DeletePortfolio(ctx, createdPortfolio.ID)
		require.NoError(t, err)
		assert.Equal(t, createdPortfolio.ID, deletedID)

		// Verify portfolio is deleted
		portfolio, err := queryResolver.Portfolio(ctx, createdPortfolio.ID)
		require.NoError(t, err)
		assert.Nil(t, portfolio)
	})
}

// TestGraphQLIntegration_AssetOperations tests all Asset GraphQL operations
func TestGraphQLIntegration_AssetOperations(t *testing.T) {
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
	mutationResolver := &mutationResolver{resolver}

	// Seed test data for asset types
	testData := testDB.SeedTestData(ctx)
	stockAssetType := testData.AssetTypes[0]  // Should be "Stock"
	cryptoAssetType := testData.AssetTypes[1] // Should be "Crypto"

	t.Run("CreateStockAsset", func(t *testing.T) {
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

		stock, err := mutationResolver.CreateStockAsset(ctx, input)
		require.NoError(t, err)
		assert.NotNil(t, stock)
		assert.Equal(t, "Apple Inc", stock.Name)
		assert.Equal(t, "AAPL", stock.Ticker)
		assert.Equal(t, 10.0, stock.Quantity)
		assert.NotEmpty(t, stock.ID)
	})

	t.Run("CreateCryptoAsset", func(t *testing.T) {
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

		crypto, err := mutationResolver.CreateCryptoAsset(ctx, input)
		require.NoError(t, err)
		assert.NotNil(t, crypto)
		assert.Equal(t, "Bitcoin", crypto.Name)
		assert.Equal(t, "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", *crypto.WalletAddress)
		assert.Equal(t, 0.5, crypto.Quantity)
		assert.NotEmpty(t, crypto.ID)

		createdAsset, lookupErr := uow.Asset().GetByID(ctx, crypto.ID)
		require.NoError(t, lookupErr)
		assert.False(t, createdAsset.IsTradeable)
	})

	t.Run("GetAsset", func(t *testing.T) {
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
		createdAsset, err := mutationResolver.CreateStockAsset(ctx, input)
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

	t.Run("GetAssets", func(t *testing.T) {
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
		_, err := mutationResolver.CreateStockAsset(ctx, stockInput)
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
		_, err = mutationResolver.CreateCryptoAsset(ctx, cryptoInput)
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
		assert.Len(t, paginatedAssets, 1)
	})

	t.Run("GetAssetTypes", func(t *testing.T) {
		assetTypes, err := queryResolver.AssetTypes(ctx)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(assetTypes), 2)

		// Verify we have stock and crypto types (using display names)
		typeNames := make(map[string]bool)
		for _, assetType := range assetTypes {
			typeNames[assetType.Name] = true
		}
		assert.True(t, typeNames["Stock"])
		assert.True(t, typeNames["Crypto"])
	})
}

// TestGraphQLIntegration_TransactionOperations tests Transaction GraphQL operations
func TestGraphQLIntegration_TransactionOperations(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	// Setup services
	uow := repository.NewUnitOfWork(testDB.DB)
	transactionService := service.NewTransactionService(uow)
	assetService := service.NewAssetService(uow.Asset())
	tagService := service.NewTagService(uow)
	resolver := &Resolver{
		TransactionService: transactionService,
		AssetService:       assetService,
		TagService:         tagService,
		UOW:                uow,
	}

	queryResolver := &queryResolver{resolver}

	// Seed test data
	testData := testDB.SeedTestData(ctx)
	testUser := testData.Users[0]
	testAsset := testData.Assets[0]

	// Create a portfolio
	portfolio := &model.Portfolio{
		UserID: testUser.ID,
		Name:   "Test Portfolio",
	}
	err := testDB.DB.NewInsert().Model(portfolio).Returning("*").Scan(ctx, portfolio)
	require.NoError(t, err)

	// Create a position
	position := &model.Position{
		PortfolioID: portfolio.ID,
		AssetID:     testAsset.ID,
		Quantity:    decimal.NewFromInt(10),
	}
	err = testDB.DB.NewInsert().Model(position).Returning("*").Scan(ctx, position)
	require.NoError(t, err)

	t.Run("GetTransaction", func(t *testing.T) {
		// Create a transaction directly in the database for testing
		transaction := &model.Transaction{
			UserID:     testUser.ID,
			PositionID: &position.ID,
			Type:       model.TransactionTypeBuy,
			Amount:     model.Money(150000), // 1500.00
			ExecutedAt: time.Now(),
		}
		err := testDB.DB.NewInsert().Model(transaction).Returning("*").Scan(ctx, transaction)
		require.NoError(t, err)

		// Get the transaction
		retrievedTransaction, err := queryResolver.Transaction(ctx, transaction.ID)
		require.NoError(t, err)
		assert.NotNil(t, retrievedTransaction)
		assert.Equal(t, transaction.ID, retrievedTransaction.ID)
		assert.Equal(t, gqlModel.TransactionTypeBuy, retrievedTransaction.TransactionType)
	})

	t.Run("GetTransactions", func(t *testing.T) {
		// Create multiple transactions directly in the database
		transactions := []*model.Transaction{
			{
				UserID:     testUser.ID,
				PositionID: &position.ID,
				Type:       model.TransactionTypeBuy,
				Amount:     model.Money(50000),
				ExecutedAt: time.Now().AddDate(0, 0, -1),
			},
			{
				UserID:     testUser.ID,
				PositionID: &position.ID,
				Type:       model.TransactionTypeSell,
				Amount:     model.Money(40000),
				ExecutedAt: time.Now(),
			},
		}

		for _, transaction := range transactions {
			err := testDB.DB.NewInsert().Model(transaction).Returning("*").Scan(ctx, transaction)
			require.NoError(t, err)
		}

		// Get all transactions
		allTransactions, err := queryResolver.Transactions(ctx, nil, nil, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(allTransactions), 2)

		// Test filtering by portfolio ID
		// Test filtering by user ID
		userIDStr := testUser.ID
		filter := &gqlModel.TransactionFilter{UserID: &userIDStr}
		portfolioTransactions, err := queryResolver.Transactions(ctx, filter, nil, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(portfolioTransactions), 2)

		// Test filtering by transaction type
		transactionType := gqlModel.TransactionTypeBuy
		typeFilter := &gqlModel.TransactionFilter{TransactionType: &transactionType}
		buyTransactions, err := queryResolver.Transactions(ctx, typeFilter, nil, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(buyTransactions), 1)
		for _, transaction := range buyTransactions {
			assert.Equal(t, gqlModel.TransactionTypeBuy, transaction.TransactionType)
		}

		// Test pagination
		pagination := &gqlModel.PaginationInput{Limit: &[]int32{1}[0]}
		paginatedTransactions, err := queryResolver.Transactions(ctx, nil, pagination, nil)
		require.NoError(t, err)
		assert.Len(t, paginatedTransactions, 1)
	})
}

// TestGraphQLIntegration_WatchlistOperations tests Watchlist GraphQL operations
func TestGraphQLIntegration_WatchlistOperations(t *testing.T) {
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
	mutationResolver := &mutationResolver{resolver}

	// Create a test user first
	userInput := gqlModel.CreateUserInput{
		Username: "watchlistuser",
		Email:    "watchlist@example.com",
		Password: "password123",
	}
	testUser, err := mutationResolver.CreateUser(ctx, userInput)
	require.NoError(t, err)

	// Seed test data for assets
	testData := testDB.SeedTestData(ctx)

	t.Run("CreateWatchlist", func(t *testing.T) {
		input := gqlModel.CreateWatchlistInput{
			UserID: testUser.ID,
			Name:   "My Watchlist",
		}

		watchlist, err := mutationResolver.CreateWatchlist(ctx, input)
		require.NoError(t, err)
		assert.NotNil(t, watchlist)
		assert.Equal(t, "My Watchlist", watchlist.Name)
		assert.NotEmpty(t, watchlist.ID)
	})

	t.Run("GetWatchlist", func(t *testing.T) {
		// Create a watchlist first
		input := gqlModel.CreateWatchlistInput{
			UserID: testUser.ID,
			Name:   "Get Watchlist",
		}
		createdWatchlist, err := mutationResolver.CreateWatchlist(ctx, input)
		require.NoError(t, err)

		// Get the watchlist
		watchlist, err := queryResolver.Watchlist(ctx, createdWatchlist.ID)
		require.NoError(t, err)
		assert.NotNil(t, watchlist)
		assert.Equal(t, createdWatchlist.ID, watchlist.ID)
		assert.Equal(t, "Get Watchlist", watchlist.Name)
	})

	t.Run("GetWatchlists", func(t *testing.T) {
		// Create multiple watchlists
		watchlists := []string{"Watchlist 1", "Watchlist 2"}
		for _, name := range watchlists {
			input := gqlModel.CreateWatchlistInput{
				UserID: testUser.ID,
				Name:   name,
			}
			_, err := mutationResolver.CreateWatchlist(ctx, input)
			require.NoError(t, err)
		}

		// Get all watchlists
		allWatchlists, err := queryResolver.Watchlists(ctx, nil, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(allWatchlists), 2)

		// Test filtering by user ID
		filter := &gqlModel.WatchlistFilter{UserID: testUser.ID}
		userWatchlists, err := queryResolver.Watchlists(ctx, filter, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(userWatchlists), 2)

		// Test pagination
		pagination := &gqlModel.PaginationInput{Limit: &[]int32{1}[0]}
		paginatedWatchlists, err := queryResolver.Watchlists(ctx, nil, pagination)
		require.NoError(t, err)
		assert.Len(t, paginatedWatchlists, 1)
	})

	t.Run("AddAssetToWatchlist", func(t *testing.T) {
		// Create a watchlist first
		input := gqlModel.CreateWatchlistInput{
			UserID: testUser.ID,
			Name:   "Asset Watchlist",
		}
		createdWatchlist, err := mutationResolver.CreateWatchlist(ctx, input)
		require.NoError(t, err)

		// Add asset to watchlist
		assetIDStr := testData.Assets[0].ID
		updatedWatchlist, err := mutationResolver.AddAssetToWatchlist(ctx, createdWatchlist.ID, assetIDStr)
		require.NoError(t, err)
		assert.NotNil(t, updatedWatchlist)
		assert.Equal(t, createdWatchlist.ID, updatedWatchlist.ID)
	})

	t.Run("RemoveAssetFromWatchlist", func(t *testing.T) {
		// Create a watchlist and add an asset
		input := gqlModel.CreateWatchlistInput{
			UserID: testUser.ID,
			Name:   "Remove Asset Watchlist",
		}
		createdWatchlist, err := mutationResolver.CreateWatchlist(ctx, input)
		require.NoError(t, err)

		assetIDStr := testData.Assets[0].ID
		_, err = mutationResolver.AddAssetToWatchlist(ctx, createdWatchlist.ID, assetIDStr)
		require.NoError(t, err)

		// Remove asset from watchlist
		updatedWatchlist, err := mutationResolver.RemoveAssetFromWatchlist(ctx, createdWatchlist.ID, assetIDStr)
		require.NoError(t, err)
		assert.NotNil(t, updatedWatchlist)
		assert.Equal(t, createdWatchlist.ID, updatedWatchlist.ID)
	})

	t.Run("DeleteWatchlist", func(t *testing.T) {
		// Create a watchlist first
		input := gqlModel.CreateWatchlistInput{
			UserID: testUser.ID,
			Name:   "Delete Watchlist",
		}
		createdWatchlist, err := mutationResolver.CreateWatchlist(ctx, input)
		require.NoError(t, err)

		// Delete the watchlist
		deletedID, err := mutationResolver.DeleteWatchlist(ctx, createdWatchlist.ID)
		require.NoError(t, err)
		assert.Equal(t, createdWatchlist.ID, deletedID)

		// Verify watchlist is deleted
		watchlist, err := queryResolver.Watchlist(ctx, createdWatchlist.ID)
		require.NoError(t, err)
		assert.Nil(t, watchlist)
	})
}

// TestGraphQLIntegration_ComplexRelationships tests complex relationship loading and filtering
func TestGraphQLIntegration_ComplexRelationships(t *testing.T) {
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
	mutationResolver := &mutationResolver{resolver}

	// Seed test data
	testData := testDB.SeedTestData(ctx)

	// Create additional test user
	userInput := gqlModel.CreateUserInput{
		Username: "complexuser",
		Email:    "complex@example.com",
		Password: "password123",
	}
	testUser, err := mutationResolver.CreateUser(ctx, userInput)
	require.NoError(t, err)

	ctx = context.WithValue(ctx, middleware.UserKey, &middleware.AuthenticatedUser{
		ID:    testUser.ID,
		Email: testUser.Email,
	})

	t.Run("PortfolioWithAssets", func(t *testing.T) {
		// Create a portfolio
		portfolioInput := gqlModel.CreatePortfolioInput{
			UserID: testUser.ID,
			Name:   "Complex Portfolio",
		}
		portfolio, err := mutationResolver.CreatePortfolio(ctx, portfolioInput)
		require.NoError(t, err)

		// Create a stock asset
		currentValue := 800.0
		purchaseDate := time.Now()
		purchasePrice := 750.0
		stockInput := gqlModel.CreateStockInput{
			Name:          "Tesla",
			AssetTypeID:   string(*testData.AssetTypes[0]),
			CurrentValue:  &currentValue,
			PurchaseDate:  &purchaseDate,
			PurchasePrice: &purchasePrice,
			Ticker:        "TSLA",
			Quantity:      5.0,
			QuoteCurrency: "USD",
		}
		stock, err := mutationResolver.CreateStockAsset(ctx, stockInput)
		require.NoError(t, err)

		// Add asset to portfolio
		portfolioAssetInput := gqlModel.PortfolioAssetInput{
			PortfolioID:          portfolio.ID,
			AssetID:              stock.ID,
			Quantity:             5.0,
			AveragePurchasePrice: &[]float64{750.0}[0],
		}
		portfolioAsset, err := mutationResolver.AddAssetToPortfolio(ctx, portfolioAssetInput)
		require.NoError(t, err)
		assert.NotNil(t, portfolioAsset)
		assert.Equal(t, 5.0, portfolioAsset.Quantity)

		// Verify the relationship
		retrievedPortfolio, err := queryResolver.Portfolio(ctx, portfolio.ID)
		require.NoError(t, err)
		assert.NotNil(t, retrievedPortfolio)
		assert.Equal(t, portfolio.ID, retrievedPortfolio.ID)
	})

	t.Run("TaggingOperations", func(t *testing.T) {
		// Create a tag first
		tag := &model.Tag{
			Name:   "Tech Stock",
			UserID: testUser.ID,
		}
		err := testDB.DB.NewInsert().Model(tag).Returning("*").Scan(ctx, tag)
		require.NoError(t, err)

		// Create a stock asset
		currentValue := 3200.0
		purchaseDate := time.Now()
		purchasePrice := 3000.0
		stockInput := gqlModel.CreateStockInput{
			Name:          "Amazon",
			AssetTypeID:   string(*testData.AssetTypes[0]),
			CurrentValue:  &currentValue,
			PurchaseDate:  &purchaseDate,
			PurchasePrice: &purchasePrice,
			Ticker:        "AMZN",
			Quantity:      1.0,
			QuoteCurrency: "USD",
		}
		stock, err := mutationResolver.CreateStockAsset(ctx, stockInput)
		require.NoError(t, err)

		// Tag the asset
		tagIDStr := tag.ID
		taggedAsset, err := mutationResolver.TagAsset(ctx, stock.ID, tagIDStr)
		require.NoError(t, err)
		assert.NotNil(t, taggedAsset)

		// Untag the asset
		untaggedAsset, err := mutationResolver.UntagAsset(ctx, stock.ID, tagIDStr)
		require.NoError(t, err)
		assert.NotNil(t, untaggedAsset)

		// Create a portfolio and tag it
		portfolioInput := gqlModel.CreatePortfolioInput{
			UserID: testUser.ID,
			Name:   "Tagged Portfolio",
		}
		portfolio, err := mutationResolver.CreatePortfolio(ctx, portfolioInput)
		require.NoError(t, err)

		// Tag the portfolio
		taggedPortfolio, err := mutationResolver.TagPortfolio(ctx, portfolio.ID, tagIDStr)
		require.NoError(t, err)
		assert.NotNil(t, taggedPortfolio)
		assert.Equal(t, portfolio.ID, taggedPortfolio.ID)

		// Untag the portfolio
		untaggedPortfolio, err := mutationResolver.UntagPortfolio(ctx, portfolio.ID, tagIDStr)
		require.NoError(t, err)
		assert.NotNil(t, untaggedPortfolio)
		assert.Equal(t, portfolio.ID, untaggedPortfolio.ID)
	})

	t.Run("TagQueries", func(t *testing.T) {
		// Get all tags
		tags, err := queryResolver.Tags(ctx)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(tags), 1)

		// Get specific tag
		if len(tags) > 0 {
			tag, err := queryResolver.Tag(ctx, tags[0].ID)
			require.NoError(t, err)
			assert.NotNil(t, tag)
			assert.Equal(t, tags[0].ID, tag.ID)
		}
	})

	t.Run("PortfolioAssetManagement", func(t *testing.T) {
		// Create a portfolio
		portfolioInput := gqlModel.CreatePortfolioInput{
			UserID: testUser.ID,
			Name:   "Asset Management Portfolio",
		}
		portfolio, err := mutationResolver.CreatePortfolio(ctx, portfolioInput)
		require.NoError(t, err)

		// Create a crypto asset
		currentValue3 := 1.5
		purchaseDate3 := time.Now()
		purchasePrice3 := 1.2
		walletAddress3 := "addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2"
		blockchainNetwork3 := "Cardano"
		cryptoInput := gqlModel.CreateCryptoInput{
			Name:              "Cardano",
			AssetTypeID:       string(*testData.AssetTypes[1]),
			CurrentValue:      &currentValue3,
			PurchaseDate:      &purchaseDate3,
			PurchasePrice:     &purchasePrice3,
			WalletAddress:     &walletAddress3,
			BlockchainNetwork: &blockchainNetwork3,
			Quantity:          100.0,
			QuoteCurrency:     "USD",
		}
		crypto, err := mutationResolver.CreateCryptoAsset(ctx, cryptoInput)
		require.NoError(t, err)

		// Add asset to portfolio
		portfolioAssetInput := gqlModel.PortfolioAssetInput{
			PortfolioID:          portfolio.ID,
			AssetID:              crypto.ID,
			Quantity:             100.0,
			AveragePurchasePrice: &[]float64{1.2}[0],
		}
		portfolioAsset, err := mutationResolver.AddAssetToPortfolio(ctx, portfolioAssetInput)
		require.NoError(t, err)
		assert.NotNil(t, portfolioAsset)

		// Update asset in portfolio
		updateInput := gqlModel.PortfolioAssetInput{
			PortfolioID:          portfolio.ID,
			AssetID:              crypto.ID,
			Quantity:             150.0,
			AveragePurchasePrice: &[]float64{1.3}[0],
		}
		updatedPortfolioAsset, err := mutationResolver.UpdateAssetInPortfolio(ctx, updateInput)
		require.NoError(t, err)
		assert.NotNil(t, updatedPortfolioAsset)
		assert.Equal(t, 150.0, updatedPortfolioAsset.Quantity)

		// Remove asset from portfolio
		removedAssetID, err := mutationResolver.RemoveAssetFromPortfolio(ctx, portfolio.ID, crypto.ID)
		require.NoError(t, err)
		assert.Equal(t, crypto.ID, removedAssetID)
	})

	t.Run("FilteringAndPagination", func(t *testing.T) {
		// Test complex filtering scenarios
		// Create multiple users, portfolios, and assets for comprehensive filtering tests

		// Create another user
		user2Input := gqlModel.CreateUserInput{
			Username: "filteruser",
			Email:    "filter@example.com",
			Password: "password123",
		}
		user2, err := mutationResolver.CreateUser(ctx, user2Input)
		require.NoError(t, err)

		// Create portfolios for both users
		for i, user := range []*gqlModel.User{testUser, user2} {
			userCtx := ctx
			if user.ID == user2.ID {
				userCtx = context.WithValue(ctx, middleware.UserKey, &middleware.AuthenticatedUser{
					ID:    user2.ID,
					Email: user2.Email,
				})
			}
			for j := 0; j < 3; j++ {
				portfolioInput := gqlModel.CreatePortfolioInput{
					UserID: user.ID,
					Name:   fmt.Sprintf("Portfolio %d-%d", i, j),
				}
				_, err := mutationResolver.CreatePortfolio(userCtx, portfolioInput)
				require.NoError(t, err)
			}
		}

		// Test user filtering
		userFilter := &gqlModel.PortfolioFilter{UserID: &testUser.ID}
		userPortfolios, err := queryResolver.Portfolios(ctx, userFilter, nil, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(userPortfolios), 3)
		for _, portfolio := range userPortfolios {
			assert.NotEmpty(t, portfolio.ID)
			// User field is populated by a separate resolver, so it's originally nil
		}

		// Test pagination with large dataset
		pagination := &gqlModel.PaginationInput{
			Limit:  &[]int32{2}[0],
			Offset: &[]int32{1}[0],
		}
		paginatedPortfolios, err := queryResolver.Portfolios(ctx, nil, pagination, nil)
		require.NoError(t, err)
		assert.Len(t, paginatedPortfolios, 2)

		// Test ordering
		orderBy := &gqlModel.PortfolioOrder{
			Field:     gqlModel.PortfolioOrderFieldName,
			Direction: gqlModel.SortDirectionAsc,
		}
		orderedPortfolios, err := queryResolver.Portfolios(ctx, nil, nil, orderBy)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(orderedPortfolios), 2)
		// Verify ordering (first should be lexicographically smaller)
		if len(orderedPortfolios) >= 2 {
			assert.LessOrEqual(t, orderedPortfolios[0].Name, orderedPortfolios[1].Name)
		}
	})
}
