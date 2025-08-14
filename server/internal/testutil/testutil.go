package testutil

import (
	"context"
	"sigma_finance/internal/config"
	"sigma_finance/internal/domain/model"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/uptrace/bun"
)

// TestDB holds a test database connection and provides cleanup
type TestDB struct {
	DB *bun.DB
	t  *testing.T
}

// NewTestDB creates a new test database connection
func NewTestDB(t *testing.T) *TestDB {
	db, err := config.NewTestDB()
	require.NoError(t, err, "Failed to create test database connection")

	return &TestDB{
		DB: db,
		t:  t,
	}
}

// Close closes the test database connection
func (tdb *TestDB) Close() {
	if tdb.DB != nil {
		tdb.DB.Close()
	}
}

// CleanupTables removes all data from test tables
func (tdb *TestDB) CleanupTables(ctx context.Context) {
	tables := []string{
		"sigma_finance.asset_tag",
		"sigma_finance.portfolio_tag",
		"sigma_finance.portfolio_asset",
		"sigma_finance.watchlist_asset",
		"sigma_finance.transaction",
		"sigma_finance.watchlist",
		"sigma_finance.asset",
		"sigma_finance.portfolio",
		"sigma_finance.user",
		"sigma_finance.tag",
		"sigma_finance.asset_type",
		"sigma_finance.stock",
		"sigma_finance.crypto",
		"sigma_finance.report",
		"sigma_finance.ownership",
	}

	for _, table := range tables {
		_, err := tdb.DB.NewRaw("DELETE FROM " + table).Exec(ctx)
		if err != nil {
			tdb.t.Logf("Warning: failed to cleanup table %s: %v", table, err)
		}
	}
}

// SeedTestData creates test data for testing
func (tdb *TestDB) SeedTestData(ctx context.Context) *TestData {
	// Create test users
	user1 := &model.User{
		Username: "testuser1",
		Email:    "test1@example.com",
		Password: "hashedpassword1",
	}
	user2 := &model.User{
		Username: "testuser2",
		Email:    "test2@example.com",
		Password: "hashedpassword2",
	}

	_, err := tdb.DB.NewInsert().Model(user1).Returning("*").Exec(ctx)
	require.NoError(tdb.t, err)
	_, err = tdb.DB.NewInsert().Model(user2).Returning("*").Exec(ctx)
	require.NoError(tdb.t, err)

	// Create test asset types
	assetType1 := &model.AssetType{
		Name: "Stock",
	}
	assetType2 := &model.AssetType{
		Name: "Crypto",
	}

	_, err = tdb.DB.NewInsert().Model(assetType1).Returning("*").Exec(ctx)
	require.NoError(tdb.t, err)
	_, err = tdb.DB.NewInsert().Model(assetType2).Returning("*").Exec(ctx)
	require.NoError(tdb.t, err)

	// Create test portfolios
	portfolio1 := &model.Portfolio{
		UserID: user1.ID,
		Name:   "Test Portfolio 1",
	}
	portfolio2 := &model.Portfolio{
		UserID: user2.ID,
		Name:   "Test Portfolio 2",
	}

	_, err = tdb.DB.NewInsert().Model(portfolio1).Returning("*").Exec(ctx)
	require.NoError(tdb.t, err)
	_, err = tdb.DB.NewInsert().Model(portfolio2).Returning("*").Exec(ctx)
	require.NoError(tdb.t, err)

	// Create test assets
	asset1 := &model.Asset{
		Name:          "Apple Inc",
		AssetTypeID:   assetType1.ID,
		CurrentValue:  150.0,
		PurchasePrice: 140.0,
		PurchaseDate:  time.Now().AddDate(0, -1, 0),
	}
	asset2 := &model.Asset{
		Name:          "Bitcoin",
		AssetTypeID:   assetType2.ID,
		CurrentValue:  45000.0,
		PurchasePrice: 40000.0,
		PurchaseDate:  time.Now().AddDate(0, -2, 0),
	}

	_, err = tdb.DB.NewInsert().Model(asset1).Returning("*").Exec(ctx)
	require.NoError(tdb.t, err)
	_, err = tdb.DB.NewInsert().Model(asset2).Returning("*").Exec(ctx)
	require.NoError(tdb.t, err)

	// Create test tags
	tag1 := &model.Tag{
		Name: "Technology",
	}
	tag2 := &model.Tag{
		Name: "High Risk",
	}

	_, err = tdb.DB.NewInsert().Model(tag1).Returning("*").Exec(ctx)
	require.NoError(tdb.t, err)
	_, err = tdb.DB.NewInsert().Model(tag2).Returning("*").Exec(ctx)
	require.NoError(tdb.t, err)

	return &TestData{
		Users:      []*model.User{user1, user2},
		Portfolios: []*model.Portfolio{portfolio1, portfolio2},
		Assets:     []*model.Asset{asset1, asset2},
		AssetTypes: []*model.AssetType{assetType1, assetType2},
		Tags:       []*model.Tag{tag1, tag2},
	}
}

// TestData holds seeded test data
type TestData struct {
	Users      []*model.User
	Portfolios []*model.Portfolio
	Assets     []*model.Asset
	AssetTypes []*model.AssetType
	Tags       []*model.Tag
}
