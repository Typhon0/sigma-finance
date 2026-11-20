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

	// Ensure the test tables exist
	err = acquireTestDBLock()
	require.NoError(t, err, "Failed to acquire test database lock")
	err = prepareTestSchema(ctx, db)
	if err != nil {
		releaseTestDBLock()
	}
	require.NoError(t, err, "Failed to prepare test schema")
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

var (
	testSchemaOnce sync.Once
	testSchemaErr  error
)

// prepareTestSchema makes sure the test tables exist.
//
// It builds them from the bun models (see schema.go) rather than running
// cmd/bun/migrations, which cannot run against an empty database. It runs at
// most once per process.
func prepareTestSchema(ctx context.Context, db *bun.DB) error {
	testSchemaOnce.Do(func() {
		testSchemaErr = createTestSchema(ctx, db)
	})
	return testSchemaErr
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
			"sigma_finance.tax_lot_dispositions",
			"sigma_finance.tax_lots",
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
