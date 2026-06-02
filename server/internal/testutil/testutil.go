package testutil

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sigma_finance/internal/config"
	"sigma_finance/internal/domain/model"
	"sync"
	"syscall"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/uptrace/bun"
)

// TestDB holds a test database connection and provides cleanup
type TestDB struct {
	DB      *bun.DB
	t       *testing.T
	closeMu sync.Mutex
	closed  bool
}

// schemaPermOnce ensures schema permissions are checked only once per process,
// since they persist across tests and GRANT is idempotent but wasteful to repeat.
var schemaPermOnce sync.Once

// processLock serializes test DB access within a single process (same package)
// and across processes (parallel packages via `go test ./...`).
// flock is per-FD, so a second NewTestDB in the same process would deadlock
// without a process-level guard.
var (
	processLockMu   sync.Mutex
	processLockFile *os.File
	processLockRefs int
)

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
	err = acquireTestDBLock()
	require.NoError(t, err, "Failed to acquire test database lock")
	err = runTestMigrations(ctx, db)
	if err != nil {
		releaseTestDBLock()
	}
	require.NoError(t, err, "Failed to run test migrations")
	testDB := &TestDB{
		DB: db,
		t:  t,
	}
	t.Cleanup(func() {
		testDB.Close()
	})
	return testDB
}

// acquireTestDBLock acquires the process-level lock (reentrant within this
// process) and, on the first acquisition, the cross-process flock.
func acquireTestDBLock() error {
	processLockMu.Lock()
	defer processLockMu.Unlock()

	if processLockRefs > 0 {
		// Already held by this process — just bump refcount.
		processLockRefs++
		return nil
	}

	lockPath := "/tmp/sigma_finance_test.lock"
	file, err := os.OpenFile(lockPath, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return fmt.Errorf("open lock file: %w", err)
	}

	// Use non-blocking try with retry to avoid hanging when multiple
	// test packages run in parallel via `go test ./...`.
	deadline := time.Now().Add(60 * time.Second)
	for {
		err := syscall.Flock(int(file.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
		if err == nil {
			processLockFile = file
			processLockRefs = 1
			return nil
		}
		if !errors.Is(err, syscall.EWOULDBLOCK) {
			_ = file.Close()
			return fmt.Errorf("acquire lock: %w", err)
		}
		if time.Now().After(deadline) {
			_ = file.Close()
			return fmt.Errorf("acquire lock: timed out after 60s waiting for %s", lockPath)
		}
		time.Sleep(200 * time.Millisecond)
	}
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
		-- Ensure user table exists with current authentication schema
		CREATE TABLE IF NOT EXISTS sigma_finance.user (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email VARCHAR(255) UNIQUE NOT NULL,
			email_verified BOOLEAN DEFAULT FALSE,
			name VARCHAR(255),
			password_hash VARCHAR(255),
			role VARCHAR(20) NOT NULL DEFAULT 'USER',
			display_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
			theme_preference VARCHAR(10) NOT NULL DEFAULT 'system',
			theme_base_color VARCHAR(20) NOT NULL DEFAULT 'neutral',
			theme_accent_color VARCHAR(20) NOT NULL DEFAULT 'zinc',
			theme_font_preference VARCHAR(30) NOT NULL DEFAULT 'inter',
			theme_heading_font VARCHAR(30) NOT NULL DEFAULT 'inherit',
			theme_menu_accent VARCHAR(10) NOT NULL DEFAULT 'subtle',
			theme_menu_color VARCHAR(30) NOT NULL DEFAULT 'default',
			theme_style VARCHAR(10) NOT NULL DEFAULT 'vega',
			theme_radius NUMERIC(3,2) NOT NULL DEFAULT 0.625,
			theme_rtl BOOLEAN NOT NULL DEFAULT FALSE,
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

		-- Create instrument_provider_mappings table for tests
		CREATE TABLE IF NOT EXISTS sigma_finance.instrument_provider_mappings (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			instrument_id UUID NOT NULL REFERENCES sigma_finance.instruments(id) ON DELETE CASCADE,
			provider VARCHAR(64) NOT NULL,
			provider_asset_id VARCHAR(255) NOT NULL,
			provider_symbol VARCHAR(255),
			provider_market VARCHAR(64),
			quote_currency VARCHAR(16),
			mapping_status VARCHAR(32) NOT NULL DEFAULT 'UNMAPPED',
			last_verified_at TIMESTAMPTZ,
			last_error_text TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(instrument_id, provider, provider_asset_id)
		);
		CREATE INDEX IF NOT EXISTS instrument_provider_mappings_lookup_idx 
			ON sigma_finance.instrument_provider_mappings(instrument_id, provider, mapping_status);

		-- Create historical_data_backfill_jobs table for tests
		CREATE TABLE IF NOT EXISTS sigma_finance.historical_data_backfill_jobs (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID,
			portfolio_id UUID NOT NULL,
			asset_id UUID NOT NULL,
			instrument_id UUID NOT NULL,
			provider TEXT NOT NULL DEFAULT 'YFINANCE',
			status TEXT NOT NULL,
			step TEXT NOT NULL DEFAULT 'QUEUED',
			progress INTEGER NOT NULL DEFAULT 0,
			rows_written INTEGER NOT NULL DEFAULT 0,
			error_code TEXT,
			error_message TEXT,
			requested_from TIMESTAMPTZ NOT NULL,
			requested_to TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			started_at TIMESTAMPTZ,
			finished_at TIMESTAMPTZ,
			rows_inserted INTEGER NOT NULL DEFAULT 0,
			rows_updated INTEGER NOT NULL DEFAULT 0,
			rows_skipped INTEGER NOT NULL DEFAULT 0,
			attempts INTEGER NOT NULL DEFAULT 0,
			max_attempts INTEGER NOT NULL DEFAULT 4,
			next_run_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			locked_at TIMESTAMPTZ,
			locked_by TEXT,
			heartbeat_at TIMESTAMPTZ,
			coverage_from TIMESTAMPTZ,
			coverage_to TIMESTAMPTZ,
			provider_symbol TEXT,
			UNIQUE(portfolio_id, asset_id, instrument_id, provider, requested_from, requested_to)
		);
		CREATE INDEX IF NOT EXISTS idx_hdbj_locked_at ON sigma_finance.historical_data_backfill_jobs(locked_at);
		CREATE INDEX IF NOT EXISTS idx_hdbj_status_next_run ON sigma_finance.historical_data_backfill_jobs(status, next_run_at, created_at);

		-- Create transactions table for GraphQL and service integration tests
		CREATE TABLE IF NOT EXISTS sigma_finance.transactions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL,
			position_id UUID,
			type VARCHAR(20) NOT NULL,
			amount BIGINT NOT NULL,
			quantity DECIMAL(20,8),
			unit_price_amount DECIMAL(20,8),
			unit_price_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
			fees_amount BIGINT NOT NULL DEFAULT 0,
			fees_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
			notes TEXT,
			executed_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		);

		-- Align legacy transaction columns for tests that reuse an existing schema.
		DO $$
		BEGIN
			IF EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = 'sigma_finance' AND table_name = 'transactions' AND column_name = 'price_per_unit'
			) AND NOT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = 'sigma_finance' AND table_name = 'transactions' AND column_name = 'unit_price_amount'
			) THEN
				ALTER TABLE sigma_finance.transactions RENAME COLUMN price_per_unit TO unit_price_amount;
			END IF;

			IF EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = 'sigma_finance' AND table_name = 'transactions' AND column_name = 'fee'
			) AND NOT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = 'sigma_finance' AND table_name = 'transactions' AND column_name = 'fees_amount'
			) THEN
				ALTER TABLE sigma_finance.transactions RENAME COLUMN fee TO fees_amount;
			END IF;

			IF EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = 'sigma_finance' AND table_name = 'transactions' AND column_name = 'transaction_date'
			) AND NOT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = 'sigma_finance' AND table_name = 'transactions' AND column_name = 'executed_at'
			) THEN
				ALTER TABLE sigma_finance.transactions RENAME COLUMN transaction_date TO executed_at;
			END IF;
		END $$;

		ALTER TABLE IF EXISTS sigma_finance.transactions
			ADD COLUMN IF NOT EXISTS unit_price_amount DECIMAL(20,8),
			ADD COLUMN IF NOT EXISTS unit_price_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
			ADD COLUMN IF NOT EXISTS fees_amount BIGINT NOT NULL DEFAULT 0,
			ADD COLUMN IF NOT EXISTS fees_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
			ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;

		UPDATE sigma_finance.transactions
		SET executed_at = COALESCE(executed_at, created_at, NOW())
		WHERE executed_at IS NULL;

		-- Instrument catalog columns needed by the updated asset/portfolio model
		ALTER TABLE IF EXISTS sigma_finance.instruments
			ADD COLUMN IF NOT EXISTS external_source VARCHAR(64),
			ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
		CREATE UNIQUE INDEX IF NOT EXISTS uq_instruments_external_source_id
			ON sigma_finance.instruments(external_source, external_id)
			WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

		ALTER TABLE IF EXISTS sigma_finance."user"
			ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'USER',
			ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(10) NOT NULL DEFAULT 'system',
			ADD COLUMN IF NOT EXISTS theme_base_color VARCHAR(20) NOT NULL DEFAULT 'neutral',
			ADD COLUMN IF NOT EXISTS theme_accent_color VARCHAR(20) NOT NULL DEFAULT 'zinc',
			ADD COLUMN IF NOT EXISTS theme_font_preference VARCHAR(30) NOT NULL DEFAULT 'inter',
			ADD COLUMN IF NOT EXISTS theme_heading_font VARCHAR(30) NOT NULL DEFAULT 'inherit',
			ADD COLUMN IF NOT EXISTS theme_menu_accent VARCHAR(10) NOT NULL DEFAULT 'subtle',
			ADD COLUMN IF NOT EXISTS theme_menu_color VARCHAR(30) NOT NULL DEFAULT 'default',
			ADD COLUMN IF NOT EXISTS theme_style VARCHAR(10) NOT NULL DEFAULT 'vega',
			ADD COLUMN IF NOT EXISTS theme_radius NUMERIC(3,2) NOT NULL DEFAULT 0.625,
			ADD COLUMN IF NOT EXISTS theme_rtl BOOLEAN NOT NULL DEFAULT FALSE;

	ALTER TABLE IF EXISTS sigma_finance.assets
		ADD COLUMN IF NOT EXISTS instrument_id UUID;
	ALTER TABLE IF EXISTS sigma_finance.portfolio_asset
		ADD COLUMN IF NOT EXISTS instrument_id UUID,
		ADD COLUMN IF NOT EXISTS quote_currency VARCHAR(3);
	ALTER TABLE IF EXISTS sigma_finance.positions
		ADD COLUMN IF NOT EXISTS quote_currency VARCHAR(3);

	-- Add user_id to tag table (migration 52052026)
	ALTER TABLE IF EXISTS sigma_finance.tag
		ADD COLUMN IF NOT EXISTS user_id UUID;
	UPDATE sigma_finance.tag
		SET user_id = '00000000-0000-0000-0000-000000000000'
		WHERE user_id IS NULL;
	ALTER TABLE IF EXISTS sigma_finance.tag
		ALTER COLUMN user_id SET NOT NULL;
	ALTER TABLE IF EXISTS sigma_finance.tag
		DROP CONSTRAINT IF EXISTS tag_name_key;
	DO $$
	BEGIN
		IF NOT EXISTS (
			SELECT 1 FROM pg_constraint
			WHERE conname = 'tag_user_id_name_key'
				AND conrelid = 'sigma_finance.tag'::regclass
		) THEN
			ALTER TABLE sigma_finance.tag
				ADD CONSTRAINT tag_user_id_name_key UNIQUE (user_id, name);
		END IF;
	END $$;

	-- Add search_vector to instruments (migration 51052026)
	ALTER TABLE IF EXISTS sigma_finance.instruments
		ADD COLUMN IF NOT EXISTS search_vector tsvector;
`)

	return err
}

// releaseTestDBLock decrements the process-level refcount and, when it
// reaches zero, releases the cross-process flock.
func releaseTestDBLock() {
	processLockMu.Lock()
	defer processLockMu.Unlock()

	if processLockRefs <= 0 {
		return
	}
	processLockRefs--
	if processLockRefs == 0 && processLockFile != nil {
		_ = syscall.Flock(int(processLockFile.Fd()), syscall.LOCK_UN)
		_ = processLockFile.Close()
		processLockFile = nil
	}
}

// Close closes the test database connection
func (tdb *TestDB) Close() {
	tdb.closeMu.Lock()
	if tdb.closed {
		tdb.closeMu.Unlock()
		return
	}
	tdb.closed = true
	db := tdb.DB
	tdb.DB = nil
	tdb.closeMu.Unlock()

	if db != nil {
		db.Close()
	}
	releaseTestDBLock()
}

// CleanupTables removes all data from test tables.
// NewTestDB holds the process lock for the full test lifetime, so this method
// does not need to reacquire the lock.
func (tdb *TestDB) CleanupTables(ctx context.Context) {
	if tdb.DB != nil {
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
			"sigma_finance.instruments",
			"sigma_finance.instrument_provider_mappings",
			"sigma_finance.historical_data_backfill_jobs",
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

	// Create test tags (use sentinel user_id to match migration 52052026)
	tag1 := &model.Tag{
		Name:   "Technology",
		UserID: "00000000-0000-0000-0000-000000000000",
	}
	tag2 := &model.Tag{
		Name:   "High Risk",
		UserID: "00000000-0000-0000-0000-000000000000",
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
