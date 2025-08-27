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

// NewTestDB creates a new test database connection and runs migrations
func NewTestDB(t *testing.T) *TestDB {
	db, err := config.NewTestDB()
	require.NoError(t, err, "Failed to create test database connection")

	// Run migrations to ensure tables exist
	ctx := context.Background()
	err = runTestMigrations(ctx, db)
	require.NoError(t, err, "Failed to run test migrations")

	return &TestDB{
		DB: db,
		t:  t,
	}
}

// runTestMigrations runs the database migrations for testing
func runTestMigrations(ctx context.Context, db *bun.DB) error {
	// Import migrations package to register migrations
	// Note: This is a simplified approach. In a real application, you might want
	// to use the actual migration runner from the migrations package

	// For now, we'll create the auth_event table directly for testing
	_, err := db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS sigma_finance.auth_event (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID,
			email VARCHAR(255) NOT NULL,
			action VARCHAR(50) NOT NULL,
			success BOOLEAN NOT NULL,
			ip_address INET,
			user_agent TEXT,
			metadata JSONB,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);
		
		CREATE INDEX IF NOT EXISTS idx_auth_event_user_id ON sigma_finance.auth_event(user_id);
		CREATE INDEX IF NOT EXISTS idx_auth_event_email ON sigma_finance.auth_event(email);
		CREATE INDEX IF NOT EXISTS idx_auth_event_action ON sigma_finance.auth_event(action);
		CREATE INDEX IF NOT EXISTS idx_auth_event_created_at ON sigma_finance.auth_event(created_at);
	`)

	return err
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
		"sigma_finance.auth_event",
		"sigma_finance.email_verification_token",
		"sigma_finance.password_reset_token",
		"sigma_finance.session",
		"sigma_finance.auth_method",
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
		Name:  "Test User 1",
		Email: "test1@example.com",
	}
	user2 := &model.User{
		Name:  "Test User 2",
		Email: "test2@example.com",
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

	// Note: Skipping portfolio creation due to ID type mismatch between User (string) and Portfolio (int)
	// This will be resolved when the models are aligned
	var portfolio1, portfolio2 *model.Portfolio

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
