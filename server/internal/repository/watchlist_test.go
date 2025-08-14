package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/testutil"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWatchlistRepository_Create(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	watchlistBaseRepo := NewRepository[model.Watchlist](testDB.DB)
	watchlistAssetRepo := NewRepository[model.WatchlistAsset](testDB.DB)
	assetRepo := NewRepository[model.Asset](testDB.DB)

	repo := NewWatchlistRepository(watchlistBaseRepo, watchlistAssetRepo, assetRepo)

	watchlist := &model.Watchlist{
		UserID: testData.Users[0].ID,
		Name:   "My Watchlist",
	}

	createdWatchlist, err := repo.Create(ctx, watchlist)
	require.NoError(t, err)
	assert.NotZero(t, createdWatchlist.ID)
	assert.Equal(t, "My Watchlist", createdWatchlist.Name)
	assert.Equal(t, testData.Users[0].ID, createdWatchlist.UserID)
}

func TestWatchlistRepository_GetByUserID(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	watchlistBaseRepo := NewRepository[model.Watchlist](testDB.DB)
	watchlistAssetRepo := NewRepository[model.WatchlistAsset](testDB.DB)
	assetRepo := NewRepository[model.Asset](testDB.DB)

	repo := NewWatchlistRepository(watchlistBaseRepo, watchlistAssetRepo, assetRepo)

	// Create test watchlists
	watchlist1 := &model.Watchlist{
		UserID: testData.Users[0].ID,
		Name:   "Watchlist 1",
	}
	watchlist2 := &model.Watchlist{
		UserID: testData.Users[0].ID,
		Name:   "Watchlist 2",
	}
	watchlist3 := &model.Watchlist{
		UserID: testData.Users[1].ID,
		Name:   "Other User Watchlist",
	}

	_, err := repo.Create(ctx, watchlist1)
	require.NoError(t, err)
	_, err = repo.Create(ctx, watchlist2)
	require.NoError(t, err)
	_, err = repo.Create(ctx, watchlist3)
	require.NoError(t, err)

	// Test GetByUserID
	watchlists, err := repo.GetByUserID(ctx, testData.Users[0].ID)
	require.NoError(t, err)
	assert.Len(t, watchlists, 2)

	// Verify all watchlists belong to the correct user
	for _, wl := range watchlists {
		assert.Equal(t, testData.Users[0].ID, wl.UserID)
	}
}

func TestWatchlistRepository_AddAsset(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	watchlistBaseRepo := NewRepository[model.Watchlist](testDB.DB)
	watchlistAssetRepo := NewRepository[model.WatchlistAsset](testDB.DB)
	assetRepo := NewRepository[model.Asset](testDB.DB)

	repo := NewWatchlistRepository(watchlistBaseRepo, watchlistAssetRepo, assetRepo)

	// Create a watchlist
	watchlist := &model.Watchlist{
		UserID: testData.Users[0].ID,
		Name:   "My Watchlist",
	}
	createdWatchlist, err := repo.Create(ctx, watchlist)
	require.NoError(t, err)

	// Add asset to watchlist
	err = repo.AddAsset(ctx, createdWatchlist.ID, testData.Assets[0].ID)
	require.NoError(t, err)

	// Verify asset was added
	assets, err := repo.GetAssets(ctx, createdWatchlist.ID)
	require.NoError(t, err)
	assert.Len(t, assets, 1)
	assert.Equal(t, testData.Assets[0].ID, assets[0].ID)
}

func TestWatchlistRepository_AddAsset_NonexistentWatchlist(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	watchlistBaseRepo := NewRepository[model.Watchlist](testDB.DB)
	watchlistAssetRepo := NewRepository[model.WatchlistAsset](testDB.DB)
	assetRepo := NewRepository[model.Asset](testDB.DB)

	repo := NewWatchlistRepository(watchlistBaseRepo, watchlistAssetRepo, assetRepo)

	// Try to add asset to non-existent watchlist
	err := repo.AddAsset(ctx, 999, testData.Assets[0].ID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "watchlist not found")
}

func TestWatchlistRepository_AddAsset_NonexistentAsset(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	watchlistBaseRepo := NewRepository[model.Watchlist](testDB.DB)
	watchlistAssetRepo := NewRepository[model.WatchlistAsset](testDB.DB)
	assetRepo := NewRepository[model.Asset](testDB.DB)

	repo := NewWatchlistRepository(watchlistBaseRepo, watchlistAssetRepo, assetRepo)

	// Create a watchlist
	watchlist := &model.Watchlist{
		UserID: testData.Users[0].ID,
		Name:   "My Watchlist",
	}
	createdWatchlist, err := repo.Create(ctx, watchlist)
	require.NoError(t, err)

	// Try to add non-existent asset
	err = repo.AddAsset(ctx, createdWatchlist.ID, 999)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "asset not found")
}

func TestWatchlistRepository_RemoveAsset(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	watchlistBaseRepo := NewRepository[model.Watchlist](testDB.DB)
	watchlistAssetRepo := NewRepository[model.WatchlistAsset](testDB.DB)
	assetRepo := NewRepository[model.Asset](testDB.DB)

	repo := NewWatchlistRepository(watchlistBaseRepo, watchlistAssetRepo, assetRepo)

	// Create a watchlist and add an asset
	watchlist := &model.Watchlist{
		UserID: testData.Users[0].ID,
		Name:   "My Watchlist",
	}
	createdWatchlist, err := repo.Create(ctx, watchlist)
	require.NoError(t, err)

	err = repo.AddAsset(ctx, createdWatchlist.ID, testData.Assets[0].ID)
	require.NoError(t, err)

	// Remove the asset
	err = repo.RemoveAsset(ctx, createdWatchlist.ID, testData.Assets[0].ID)
	require.NoError(t, err)

	// Verify asset was removed
	assets, err := repo.GetAssets(ctx, createdWatchlist.ID)
	require.NoError(t, err)
	assert.Len(t, assets, 0)
}

func TestWatchlistRepository_RemoveAsset_NotInWatchlist(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	watchlistBaseRepo := NewRepository[model.Watchlist](testDB.DB)
	watchlistAssetRepo := NewRepository[model.WatchlistAsset](testDB.DB)
	assetRepo := NewRepository[model.Asset](testDB.DB)

	repo := NewWatchlistRepository(watchlistBaseRepo, watchlistAssetRepo, assetRepo)

	// Create a watchlist without adding the asset
	watchlist := &model.Watchlist{
		UserID: testData.Users[0].ID,
		Name:   "My Watchlist",
	}
	createdWatchlist, err := repo.Create(ctx, watchlist)
	require.NoError(t, err)

	// Try to remove asset that's not in the watchlist
	err = repo.RemoveAsset(ctx, createdWatchlist.ID, testData.Assets[0].ID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "asset not found in watchlist")
}

func TestWatchlistRepository_GetAssets(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	watchlistBaseRepo := NewRepository[model.Watchlist](testDB.DB)
	watchlistAssetRepo := NewRepository[model.WatchlistAsset](testDB.DB)
	assetRepo := NewRepository[model.Asset](testDB.DB)

	repo := NewWatchlistRepository(watchlistBaseRepo, watchlistAssetRepo, assetRepo)

	// Create a watchlist and add multiple assets
	watchlist := &model.Watchlist{
		UserID: testData.Users[0].ID,
		Name:   "My Watchlist",
	}
	createdWatchlist, err := repo.Create(ctx, watchlist)
	require.NoError(t, err)

	err = repo.AddAsset(ctx, createdWatchlist.ID, testData.Assets[0].ID)
	require.NoError(t, err)
	err = repo.AddAsset(ctx, createdWatchlist.ID, testData.Assets[1].ID)
	require.NoError(t, err)

	// Get all assets
	assets, err := repo.GetAssets(ctx, createdWatchlist.ID)
	require.NoError(t, err)
	assert.Len(t, assets, 2)

	// Verify asset IDs
	assetIDs := make([]int, len(assets))
	for i, asset := range assets {
		assetIDs[i] = asset.ID
	}
	assert.Contains(t, assetIDs, testData.Assets[0].ID)
	assert.Contains(t, assetIDs, testData.Assets[1].ID)
}

func TestWatchlistRepository_GetAssets_EmptyWatchlist(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)
	testData := testDB.SeedTestData(ctx)

	watchlistBaseRepo := NewRepository[model.Watchlist](testDB.DB)
	watchlistAssetRepo := NewRepository[model.WatchlistAsset](testDB.DB)
	assetRepo := NewRepository[model.Asset](testDB.DB)

	repo := NewWatchlistRepository(watchlistBaseRepo, watchlistAssetRepo, assetRepo)

	// Create an empty watchlist
	watchlist := &model.Watchlist{
		UserID: testData.Users[0].ID,
		Name:   "Empty Watchlist",
	}
	createdWatchlist, err := repo.Create(ctx, watchlist)
	require.NoError(t, err)

	// Get assets from empty watchlist
	assets, err := repo.GetAssets(ctx, createdWatchlist.ID)
	require.NoError(t, err)
	assert.Len(t, assets, 0)
}
