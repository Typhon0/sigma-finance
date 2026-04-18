package testutil

import (
	"context"
	"fmt"
	"os"
	"sigma_finance/internal/config"
	"sigma_finance/internal/domain/model"
	"sync"
	"syscall"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/uptrace/bun"
)

// TestDB holds a test database connection and provides cleanup
type TestDB struct {
	DB *bun.DB
	t  *testing.T
}

// schemaPermOnce ensures schema permissions are checked only once per process,
// since they persist across tests and GRANT is idempotent but wasteful to repeat.
var schemaPermOnce sync.Once

// NewTestDB creates a new test database connection and runs migrations.
// On first call per process, it ensures the test user has schema permissions
// by connecting as admin and granting them if needed.
func NewTestDB(t *testing.T) *TestDB {
	db, err := config.NewTestDB()
	require.NoError(t, err, "Failed to create test database connection")

	// Ensure schema permissions once per process before running migrations
	ctx := context.Background()
	schemaPermOnce.Do(func() {
		if permErr := ensureSchemaPermissions(ctx); permErr != nil {
			t.Logf("Warning: could not ensure schema permissions via admin connection: %v", permErr)
			t.Log("Proceeding anyway — permissions may already be granted.")
		}
	})

	// Run migrations to ensure tables exist
	lockFile, err := acquireTestDBLock()
	require.NoError(t, err, "Failed to acquire test database lock")
	err = runTestMigrations(ctx, db)
	releaseTestDBLock(lockFile)
	require.NoError(t, err, "Failed to run test migrations")

	return &TestDB{
		DB: db,
		t:  t,
	}
}

func acquireTestDBLock() (*os.File, error) {
	lockPath := "/tmp/sigma_finance_test.lock"
	file, err := os.OpenFile(lockPath, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, fmt.Errorf("open lock file: %w", err)
	}

	if err := syscall.Flock(int(file.Fd()), syscall.LOCK_EX); err != nil {
		_ = file.Close()
		return nil, fmt.Errorf("acquire lock: %w", err)
	}

	return file, nil
}

// ensureSchemaPermissions connects to the test database as admin and grants
// the test user full access to the sigma_finance schema. If the admin
// connection fails (e.g. wrong credentials), it returns an error but does
// not fail the test — the permissions may already be in place.
func ensureSchemaPermissions(ctx context.Context) error {
	adminDB, err := config.NewAdminTestDB()
	if err != nil {
		return fmt.Errorf("admin DB connection failed: %w", err)
	}
	defer adminDB.Close()

	err = config.EnsureTestSchemaPermissions(ctx, adminDB)
	if err != nil {
		return fmt.Errorf("ensure schema permissions failed: %w", err)
	}

	return nil
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

		-- Create transactions table for GraphQL and service integration tests
		CREATE TABLE IF NOT EXISTS sigma_finance.transactions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL,
			position_id UUID,
			type VARCHAR(20) NOT NULL,
			amount BIGINT NOT NULL,
			quantity DECIMAL(20,8),
			price_per_unit DECIMAL(20,8),
			fee BIGINT DEFAULT 0,
			notes TEXT,
			transaction_date TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		);

		-- Instrument catalog columns needed by the updated asset/portfolio model
		ALTER TABLE IF EXISTS sigma_finance.assets
			ADD COLUMN IF NOT EXISTS instrument_id UUID;
		ALTER TABLE IF EXISTS sigma_finance.portfolio_asset
			ADD COLUMN IF NOT EXISTS instrument_id UUID;
	`)

	return err
}

// Close closes the test database connection
func releaseTestDBLock(file *os.File) {
	if file == nil {
		return
	}
	_ = syscall.Flock(int(file.Fd()), syscall.LOCK_UN)
	_ = file.Close()
}

// Close closes the test database connection
func (tdb *TestDB) Close() {
	if tdb.DB != nil {
		tdb.DB.Close()
	}
}

// CleanupTables removes all data from test tables
func (tdb *TestDB) CleanupTables(ctx context.Context) {
	lockFile, err := acquireTestDBLock()
	if err != nil {
		tdb.t.Logf("Warning: failed to acquire cleanup lock: %v", err)
	} else {
		defer releaseTestDBLock(lockFile)
	}

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
		"sigma_finance.watchlist",
		"sigma_finance.assets",
		"sigma_finance.positions",
		"sigma_finance.transactions",
		"sigma_finance.portfolio_performance",
		"sigma_finance.user_alerts",
		"sigma_finance.asset_prices",
		"sigma_finance.asset_allocations",
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
		_, err := tdb.DB.NewRaw("TRUNCATE TABLE " + table + " CASCADE").Exec(ctx)
		if err != nil {
			tdb.t.Logf("Warning: failed to cleanup table %s: %v", table, err)
		}
	}

	// Add debug check
	var count int
	if err := tdb.DB.NewRaw("SELECT count(*) FROM sigma_finance.assets").Scan(ctx, &count); err == nil {
		if count > 0 {
			tdb.t.Logf("ERROR: assets table still has %d rows after TRUNCATE CASCADE!", count)
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

	err := tdb.DB.NewInsert().Model(user1).Returning("*").Scan(ctx, user1)
	require.NoError(tdb.t, err)
	err = tdb.DB.NewInsert().Model(user2).Returning("*").Scan(ctx, user2)
	require.NoError(tdb.t, err)

	// Create test asset types (represented as strings in the model)
	stockType := model.AssetTypeStock
	cryptoType := model.AssetTypeCrypto

	// Create test assets
	asset1 := &model.Asset{
		Type:        stockType,
		Name:        "Apple Inc Seed",
		Symbol:      &[]string{"AAPL_SEED"}[0],
		IsTradeable: true,
	}
	asset2 := &model.Asset{
		Type:        cryptoType,
		Name:        "Bitcoin Seed",
		Symbol:      &[]string{"BTC_SEED"}[0],
		IsTradeable: true,
	}

	err = tdb.DB.NewInsert().Model(asset1).Returning("*").Scan(ctx, asset1)
	require.NoError(tdb.t, err)
	err = tdb.DB.NewInsert().Model(asset2).Returning("*").Scan(ctx, asset2)
	require.NoError(tdb.t, err)

	// Create test tags
	tag1 := &model.Tag{
		Name: "Technology",
	}
	tag2 := &model.Tag{
		Name: "High Risk",
	}

	err = tdb.DB.NewInsert().Model(tag1).Returning("*").Scan(ctx, tag1)
	require.NoError(tdb.t, err)
	err = tdb.DB.NewInsert().Model(tag2).Returning("*").Scan(ctx, tag2)
	require.NoError(tdb.t, err)

	return &TestData{
		Users:      []*model.User{user1, user2},
		Portfolios: []*model.Portfolio{},
		Assets:     []*model.Asset{asset1, asset2},
		AssetTypes: []*model.AssetType{&stockType, &cryptoType},
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
