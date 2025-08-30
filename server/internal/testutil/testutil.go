package testutil

import (
	"context"
	"sigma_finance/internal/config"
	"sigma_finance/internal/domain/model"
	"testing"

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

	// Create all authentication tables for testing
	_, err := db.ExecContext(ctx, `
		-- Drop and recreate user table with correct schema for authentication
		DROP TABLE IF EXISTS sigma_finance.user CASCADE;
		CREATE TABLE sigma_finance.user (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email VARCHAR(255) UNIQUE NOT NULL,
			email_verified BOOLEAN DEFAULT FALSE,
			name VARCHAR(255),
			password_hash VARCHAR(255),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			last_login_at TIMESTAMP,
			failed_login_count INTEGER DEFAULT 0,
			locked_until TIMESTAMP
		);

		-- Create authentication methods table
		CREATE TABLE IF NOT EXISTS sigma_finance.auth_method (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL,
			provider VARCHAR(50) NOT NULL,
			external_id VARCHAR(255),
			metadata JSONB,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(provider, external_id)
		);

		-- Create sessions table
		CREATE TABLE IF NOT EXISTS sigma_finance.session (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL,
			token TEXT UNIQUE NOT NULL,
			refresh_token TEXT UNIQUE NOT NULL,
			expires_at TIMESTAMP NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			ip_address INET,
			user_agent TEXT
		);

		-- Create password reset tokens table
		CREATE TABLE IF NOT EXISTS sigma_finance.password_reset_token (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL,
			token TEXT UNIQUE NOT NULL,
			expires_at TIMESTAMP NOT NULL,
			used BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		-- Create email verification tokens table
		CREATE TABLE IF NOT EXISTS sigma_finance.email_verification_token (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL,
			token TEXT UNIQUE NOT NULL,
			expires_at TIMESTAMP NOT NULL,
			used BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		-- Create authentication audit log table
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

		-- Create indexes for performance
		CREATE INDEX IF NOT EXISTS idx_user_email ON sigma_finance.user(email);
		CREATE INDEX IF NOT EXISTS idx_user_email_verified ON sigma_finance.user(email_verified);
		CREATE INDEX IF NOT EXISTS idx_auth_method_user_id ON sigma_finance.auth_method(user_id);
		CREATE INDEX IF NOT EXISTS idx_auth_method_provider ON sigma_finance.auth_method(provider);
		CREATE INDEX IF NOT EXISTS idx_session_token ON sigma_finance.session(token);
		CREATE INDEX IF NOT EXISTS idx_session_user_id ON sigma_finance.session(user_id);
		CREATE INDEX IF NOT EXISTS idx_session_expires_at ON sigma_finance.session(expires_at);
		CREATE INDEX IF NOT EXISTS idx_password_reset_token_token ON sigma_finance.password_reset_token(token);
		CREATE INDEX IF NOT EXISTS idx_password_reset_token_user_id ON sigma_finance.password_reset_token(user_id);
		CREATE INDEX IF NOT EXISTS idx_email_verification_token_token ON sigma_finance.email_verification_token(token);
		CREATE INDEX IF NOT EXISTS idx_email_verification_token_user_id ON sigma_finance.email_verification_token(user_id);
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

	// TODO: Update test data creation for new asset management schema
	// The following code needs to be updated to match the new domain models

	// Note: Skipping asset and portfolio creation due to schema changes
	// This will be resolved when the test utilities are updated for the new asset management system
	var portfolio1, portfolio2 *model.Portfolio

	// Placeholder for future test asset creation
	// asset1 := &model.Asset{...}
	// asset2 := &model.Asset{...}

	// TODO: Uncomment and update when asset creation is fixed
	// _, err = tdb.DB.NewInsert().Model(asset1).Returning("*").Exec(ctx)
	// require.NoError(tdb.t, err)
	// _, err = tdb.DB.NewInsert().Model(asset2).Returning("*").Exec(ctx)
	// require.NoError(tdb.t, err)

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
		Assets:     []*model.Asset{},     // Empty for now until schema is updated
		AssetTypes: []*model.AssetType{}, // Empty for now until schema is updated
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
