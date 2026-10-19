package graphql

import (
	"context"
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

func TestTaxLotGraphQLWorkflow(t *testing.T) {
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
	queryResolver := &queryResolver{resolver}

	// Seed test data
	testData := testDB.SeedTestData(ctx)
	stockAssetType := testData.AssetTypes[0]
	testUser := testData.Users[0]

	ctx = context.WithValue(ctx, middleware.UserKey, &middleware.AuthenticatedUser{
		ID:    testUser.ID,
		Email: testUser.Email,
	})

	// 1. Create Stock Asset
	currentVal := 1500.0
	buyPrice := 100.0
	purchaseDate := time.Now()
	stockInput := gqlModel.CreateStockInput{
		Name:          "TotalEnergies Paris",
		Ticker:        "TTE.PA",
		AssetTypeID:   string(*stockAssetType),
		CurrentValue:  &currentVal,
		PurchasePrice: &buyPrice,
		PurchaseDate:  &purchaseDate,
		Quantity:      10.0,
		QuoteCurrency: "EUR",
	}
	stock, err := mutationResolver.CreateStockAsset(ctx, stockInput)
	require.NoError(t, err)

	// 2. Create Portfolio
	portfolioInput := gqlModel.CreatePortfolioInput{
		UserID: testUser.ID,
		Name:   "PEA Euronext Portfolio",
	}
	portfolio, err := mutationResolver.CreatePortfolio(ctx, portfolioInput)
	require.NoError(t, err)

	// 3. Add Asset to Portfolio (Initial Buy Lot: 10 shares @ 100 EUR)
	addAssetInput := gqlModel.PortfolioAssetInput{
		PortfolioID:          portfolio.ID,
		AssetID:              stock.ID,
		Quantity:             10.0,
		AveragePurchasePrice: &buyPrice,
	}
	pa, err := mutationResolver.AddAssetToPortfolio(ctx, addAssetInput)
	require.NoError(t, err)
	assert.Equal(t, 10.0, pa.Quantity)

	// Get created position ID
	position, err := uow.Position().GetByPortfolioAndAsset(ctx, portfolio.ID, stock.ID)
	require.NoError(t, err)
	require.NotNil(t, position)

	// 4. Query Tax Lots
	lots, err := queryResolver.TaxLotsByPosition(ctx, position.ID)
	require.NoError(t, err)
	require.Len(t, lots, 1)

	assert.Equal(t, 10.0, lots[0].InitialQuantity)
	assert.Equal(t, 10.0, lots[0].RemainingQuantity)
	assert.Equal(t, 100.0, lots[0].CostBasisPerUnit)
	assert.Equal(t, 1000.0, lots[0].TotalCostBasis)
	assert.Equal(t, "OPEN", lots[0].Status)
	assert.False(t, lots[0].IsLongTerm) // Brand new lot is short-term

	// 5. Add another Lot via DCA (5 shares @ 120 EUR)
	secondPrice := 120.0
	secondAddInput := gqlModel.PortfolioAssetInput{
		PortfolioID:          portfolio.ID,
		AssetID:              stock.ID,
		Quantity:             5.0,
		AveragePurchasePrice: &secondPrice,
	}
	pa2, err := mutationResolver.AddAssetToPortfolio(ctx, secondAddInput)
	require.NoError(t, err)
	assert.Equal(t, 15.0, pa2.Quantity)

	// Query Tax Lots again — both lots present
	lotsAfterDCA, err := queryResolver.TaxLotsByPosition(ctx, position.ID)
	require.NoError(t, err)
	assert.NotEmpty(t, lotsAfterDCA)

	// 6. Query Tax Harvest Opportunities
	opps, err := queryResolver.TaxHarvestOpportunities(ctx, portfolio.ID)
	require.NoError(t, err)
	assert.NotNil(t, opps)
}
