package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/testutil"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTransactionRepository_Create(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	transactionBaseRepo := NewRepository[model.Transaction](testDB.DB)
	repo := NewTransactionRepository(transactionBaseRepo)

	transaction := &model.Transaction{
		PortfolioID:     testData.Portfolios[0].ID,
		AssetID:         testData.Assets[0].ID,
		TransactionType: "BUY",
		Quantity:        10.0,
		PricePerUnit:    15.00,
		TransactionDate: time.Now(),
		Notes:           "Test transaction",
	}

	createdTransaction, err := repo.Create(ctx, transaction)
	require.NoError(t, err)
	assert.NotZero(t, createdTransaction.ID)
	assert.Equal(t, testData.Portfolios[0].ID, createdTransaction.PortfolioID)
	assert.Equal(t, testData.Assets[0].ID, createdTransaction.AssetID)
	assert.Equal(t, "BUY", createdTransaction.TransactionType)
	assert.Equal(t, 15.00, createdTransaction.PricePerUnit)
	assert.Equal(t, 10.0, createdTransaction.Quantity)
}

func TestTransactionRepository_GetByUserID(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	transactionBaseRepo := NewRepository[model.Transaction](testDB.DB)
	repo := NewTransactionRepository(transactionBaseRepo)

	// Create transactions for different users
	transaction1 := &model.Transaction{
		UserID:      testData.Users[0].ID,
		PortfolioID: &testData.Portfolios[0].ID,
		AssetID:     &testData.Assets[0].ID,
		Type:        "BUY",
		Amount:      15000,
		Quantity:    10.0,
		Timestamp:   time.Now(),
	}
	transaction2 := &model.Transaction{
		UserID:      testData.Users[0].ID,
		PortfolioID: &testData.Portfolios[0].ID,
		AssetID:     &testData.Assets[1].ID,
		Type:        "SELL",
		Amount:      5000,
		Quantity:    5.0,
		Timestamp:   time.Now(),
	}
	transaction3 := &model.Transaction{
		UserID:      testData.Users[1].ID,
		PortfolioID: &testData.Portfolios[1].ID,
		AssetID:     &testData.Assets[0].ID,
		Type:        "BUY",
		Amount:      20000,
		Quantity:    15.0,
		Timestamp:   time.Now(),
	}

	_, err := repo.Create(ctx, transaction1)
	require.NoError(t, err)
	_, err = repo.Create(ctx, transaction2)
	require.NoError(t, err)
	_, err = repo.Create(ctx, transaction3)
	require.NoError(t, err)

	// Get transactions for user 0
	transactions, err := repo.GetByUserID(ctx, testData.Users[0].ID)
	require.NoError(t, err)
	assert.Len(t, transactions, 2)

	// Verify all transactions belong to the correct user
	for _, tx := range transactions {
		assert.Equal(t, testData.Users[0].ID, tx.UserID)
	}
}

func TestTransactionRepository_GetByPortfolioID(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	transactionBaseRepo := NewRepository[model.Transaction](testDB.DB)
	repo := NewTransactionRepository(transactionBaseRepo)

	// Create transactions for different portfolios
	transaction1 := &model.Transaction{
		UserID:      testData.Users[0].ID,
		PortfolioID: &testData.Portfolios[0].ID,
		AssetID:     &testData.Assets[0].ID,
		Type:        "BUY",
		Amount:      15000,
		Quantity:    10.0,
		Timestamp:   time.Now(),
	}
	transaction2 := &model.Transaction{
		UserID:      testData.Users[0].ID,
		PortfolioID: &testData.Portfolios[0].ID,
		AssetID:     &testData.Assets[1].ID,
		Type:        "SELL",
		Amount:      5000,
		Quantity:    5.0,
		Timestamp:   time.Now(),
	}
	transaction3 := &model.Transaction{
		UserID:      testData.Users[1].ID,
		PortfolioID: &testData.Portfolios[1].ID,
		AssetID:     &testData.Assets[0].ID,
		Type:        "BUY",
		Amount:      20000,
		Quantity:    15.0,
		Timestamp:   time.Now(),
	}

	_, err := repo.Create(ctx, transaction1)
	require.NoError(t, err)
	_, err = repo.Create(ctx, transaction2)
	require.NoError(t, err)
	_, err = repo.Create(ctx, transaction3)
	require.NoError(t, err)

	// Get transactions for portfolio 0
	transactions, err := repo.GetByPortfolioID(ctx, testData.Portfolios[0].ID)
	require.NoError(t, err)
	assert.Len(t, transactions, 2)

	// Verify all transactions belong to the correct portfolio
	for _, tx := range transactions {
		assert.Equal(t, testData.Portfolios[0].ID, *tx.PortfolioID)
	}
}

func TestTransactionRepository_GetByAssetID(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	transactionBaseRepo := NewRepository[model.Transaction](testDB.DB)
	repo := NewTransactionRepository(transactionBaseRepo)

	// Create transactions for different assets
	transaction1 := &model.Transaction{
		UserID:      testData.Users[0].ID,
		PortfolioID: &testData.Portfolios[0].ID,
		AssetID:     &testData.Assets[0].ID,
		Type:        "BUY",
		Amount:      15000,
		Quantity:    10.0,
		Timestamp:   time.Now(),
	}
	transaction2 := &model.Transaction{
		UserID:      testData.Users[0].ID,
		PortfolioID: &testData.Portfolios[0].ID,
		AssetID:     &testData.Assets[0].ID,
		Type:        "SELL",
		Amount:      5000,
		Quantity:    5.0,
		Timestamp:   time.Now(),
	}
	transaction3 := &model.Transaction{
		UserID:      testData.Users[1].ID,
		PortfolioID: &testData.Portfolios[1].ID,
		AssetID:     &testData.Assets[1].ID,
		Type:        "BUY",
		Amount:      20000,
		Quantity:    15.0,
		Timestamp:   time.Now(),
	}

	_, err := repo.Create(ctx, transaction1)
	require.NoError(t, err)
	_, err = repo.Create(ctx, transaction2)
	require.NoError(t, err)
	_, err = repo.Create(ctx, transaction3)
	require.NoError(t, err)

	// Get transactions for asset 0
	transactions, err := repo.GetByAssetID(ctx, testData.Assets[0].ID)
	require.NoError(t, err)
	assert.Len(t, transactions, 2)

	// Verify all transactions belong to the correct asset
	for _, tx := range transactions {
		assert.Equal(t, testData.Assets[0].ID, *tx.AssetID)
	}
}

func TestTransactionRepository_GetByDateRange(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	transactionBaseRepo := NewRepository[model.Transaction](testDB.DB)
	repo := NewTransactionRepository(transactionBaseRepo)

	now := time.Now()
	yesterday := now.AddDate(0, 0, -1)
	tomorrow := now.AddDate(0, 0, 1)

	// Create transactions with different timestamps
	transaction1 := &model.Transaction{
		UserID:      testData.Users[0].ID,
		PortfolioID: &testData.Portfolios[0].ID,
		AssetID:     &testData.Assets[0].ID,
		Type:        "BUY",
		Amount:      15000,
		Quantity:    10.0,
		Timestamp:   yesterday,
	}
	transaction2 := &model.Transaction{
		UserID:      testData.Users[0].ID,
		PortfolioID: &testData.Portfolios[0].ID,
		AssetID:     &testData.Assets[1].ID,
		Type:        "SELL",
		Amount:      5000,
		Quantity:    5.0,
		Timestamp:   now,
	}
	transaction3 := &model.Transaction{
		UserID:      testData.Users[1].ID,
		PortfolioID: &testData.Portfolios[1].ID,
		AssetID:     &testData.Assets[0].ID,
		Type:        "BUY",
		Amount:      20000,
		Quantity:    15.0,
		Timestamp:   tomorrow,
	}

	_, err := repo.Create(ctx, transaction1)
	require.NoError(t, err)
	_, err = repo.Create(ctx, transaction2)
	require.NoError(t, err)
	_, err = repo.Create(ctx, transaction3)
	require.NoError(t, err)

	// Get transactions in date range (yesterday to now)
	transactions, err := repo.GetByDateRange(ctx, yesterday.AddDate(0, 0, -1), now.AddDate(0, 0, 1))
	require.NoError(t, err)
	assert.Len(t, transactions, 2) // Should include yesterday and now, but not tomorrow

	// Verify timestamps are within range
	for _, tx := range transactions {
		assert.True(t, tx.Timestamp.Before(now.AddDate(0, 0, 1)))
		assert.True(t, tx.Timestamp.After(yesterday.AddDate(0, 0, -1)))
	}
}

func TestTransactionRepository_GetByType(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	transactionBaseRepo := NewRepository[model.Transaction](testDB.DB)
	repo := NewTransactionRepository(transactionBaseRepo)

	// Create transactions with different types
	transaction1 := &model.Transaction{
		UserID:      testData.Users[0].ID,
		PortfolioID: &testData.Portfolios[0].ID,
		AssetID:     &testData.Assets[0].ID,
		Type:        "BUY",
		Amount:      15000,
		Quantity:    10.0,
		Timestamp:   time.Now(),
	}
	transaction2 := &model.Transaction{
		UserID:      testData.Users[0].ID,
		PortfolioID: &testData.Portfolios[0].ID,
		AssetID:     &testData.Assets[1].ID,
		Type:        "BUY",
		Amount:      5000,
		Quantity:    5.0,
		Timestamp:   time.Now(),
	}
	transaction3 := &model.Transaction{
		UserID:      testData.Users[1].ID,
		PortfolioID: &testData.Portfolios[1].ID,
		AssetID:     &testData.Assets[0].ID,
		Type:        "SELL",
		Amount:      20000,
		Quantity:    15.0,
		Timestamp:   time.Now(),
	}

	_, err := repo.Create(ctx, transaction1)
	require.NoError(t, err)
	_, err = repo.Create(ctx, transaction2)
	require.NoError(t, err)
	_, err = repo.Create(ctx, transaction3)
	require.NoError(t, err)

	// Get BUY transactions
	buyTransactions, err := repo.GetByType(ctx, "BUY")
	require.NoError(t, err)
	assert.Len(t, buyTransactions, 2)

	// Verify all transactions are BUY type
	for _, tx := range buyTransactions {
		assert.Equal(t, "BUY", tx.Type)
	}

	// Get SELL transactions
	sellTransactions, err := repo.GetByType(ctx, "SELL")
	require.NoError(t, err)
	assert.Len(t, sellTransactions, 1)
	assert.Equal(t, "SELL", sellTransactions[0].Type)
}
