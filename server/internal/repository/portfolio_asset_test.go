package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/testutil"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPortfolioAssetRepository_Create(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	portfolioAssetBaseRepo := NewRepository[model.PortfolioAsset](testDB.DB)
	assetRepo := NewRepository[model.Asset](testDB.DB)
	repo := NewPortfolioAssetRepository(portfolioAssetBaseRepo, assetRepo)

	portfolioAsset := &model.PortfolioAsset{
		PortfolioID:          testData.Portfolios[0].ID,
		AssetID:              testData.Assets[0].ID,
		Quantity:             10.0,
		AveragePurchasePrice: 140.0,
	}

	createdPortfolioAsset, err := repo.Create(ctx, portfolioAsset)
	require.NoError(t, err)
	assert.Equal(t, testData.Portfolios[0].ID, createdPortfolioAsset.PortfolioID)
	assert.Equal(t, testData.Assets[0].ID, createdPortfolioAsset.AssetID)
	assert.Equal(t, 10.0, createdPortfolioAsset.Quantity)
	assert.Equal(t, 140.0, createdPortfolioAsset.AveragePurchasePrice)
}

func TestPortfolioAssetRepository_FindByPortfolioID(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	portfolioAssetBaseRepo := NewRepository[model.PortfolioAsset](testDB.DB)
	assetRepo := NewRepository[model.Asset](testDB.DB)
	repo := NewPortfolioAssetRepository(portfolioAssetBaseRepo, assetRepo)

	// Create portfolio assets for different portfolios
	portfolioAsset1 := &model.PortfolioAsset{
		PortfolioID:          testData.Portfolios[0].ID,
		AssetID:              testData.Assets[0].ID,
		Quantity:             10.0,
		AveragePurchasePrice: 140.0,
	}
	portfolioAsset2 := &model.PortfolioAsset{
		PortfolioID:          testData.Portfolios[0].ID,
		AssetID:              testData.Assets[1].ID,
		Quantity:             5.0,
		AveragePurchasePrice: 40000.0,
	}

	_, err := repo.Create(ctx, portfolioAsset1)
	require.NoError(t, err)
	_, err = repo.Create(ctx, portfolioAsset2)
	require.NoError(t, err)

	// Get portfolio assets for portfolio 0
	portfolioAssets, err := repo.FindByPortfolioID(ctx, testData.Portfolios[0].ID)
	require.NoError(t, err)
	assert.Len(t, portfolioAssets, 2)

	// Verify all portfolio assets belong to the correct portfolio
	for _, pa := range portfolioAssets {
		assert.Equal(t, testData.Portfolios[0].ID, pa.PortfolioID)
	}
}
