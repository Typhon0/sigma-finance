package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"sigma_finance/internal/config"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// setupBridgeDB returns a test DB with the tables BridgeCoverage needs,
// plus a cleanup function.  The cleanup truncates only the tables we use.
func setupBridgeDB(t *testing.T) (*bun.DB, func(), error) {
	t.Helper()

	db, err := config.NewTestDB()
	if err != nil {
		return nil, nil, fmt.Errorf("connect: %w", err)
	}

	ctx := context.Background()
	cleanup := func() {
		tables := []string{
			"sigma_finance.market_data_pack_coverage",
			"sigma_finance.market_data_packs",
			"sigma_finance.instruments",
		}
		for _, tbl := range tables {
			_, _ = db.NewRaw("TRUNCATE TABLE " + tbl + " CASCADE").Exec(ctx)
		}
		db.Close()
	}

	// Clean up from previous runs first
	cleanupTables := []string{
		"sigma_finance.market_data_pack_coverage",
		"sigma_finance.market_data_packs",
		"sigma_finance.instruments",
	}
	for _, tbl := range cleanupTables {
		_, _ = db.NewRaw("TRUNCATE TABLE " + tbl + " CASCADE").Exec(ctx)
	}

	// Ensure the market data pack tables exist in the test DB
	_, _ = db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS sigma_finance.market_data_packs (
			id TEXT PRIMARY KEY,
			version TEXT NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			format_version INTEGER NOT NULL,
			status TEXT NOT NULL,
			parent_pack_id TEXT REFERENCES sigma_finance.market_data_packs(id) ON DELETE SET NULL,
			pack_priority INTEGER NOT NULL DEFAULT 0,
			file_path TEXT NOT NULL,
			checksum TEXT NOT NULL,
			signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
			assets_count BIGINT NOT NULL DEFAULT 0,
			rows_count BIGINT NOT NULL DEFAULT 0,
			installed_at TIMESTAMPTZ,
			updated_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT market_data_packs_status_check CHECK (status IN ('available','installing','installed','failed','removed'))
		);

		CREATE TABLE IF NOT EXISTS sigma_finance.market_data_pack_coverage (
			pack_id TEXT NOT NULL REFERENCES sigma_finance.market_data_packs(id) ON DELETE CASCADE,
			instrument_id UUID NOT NULL,
			symbol TEXT NOT NULL,
			asset_type TEXT NOT NULL,
			interval TEXT NOT NULL,
			quote_currency TEXT NOT NULL,
			first_date DATE NOT NULL,
			last_date DATE NOT NULL,
			row_count BIGINT NOT NULL,
			file_paths JSONB NOT NULL,
			PRIMARY KEY (pack_id, instrument_id, interval, quote_currency)
		);
	`)

	// Ensure coverage table has the pack_instrument_id column (our migration)
	_, _ = db.ExecContext(ctx, `
		ALTER TABLE sigma_finance.market_data_pack_coverage
		ADD COLUMN IF NOT EXISTS pack_instrument_id UUID;
	`)

	return db, cleanup, nil
}

// seedInstrument inserts an instrument and returns the populated model.
func seedInstrument(t *testing.T, db *bun.DB, inst *model.Instrument) {
	t.Helper()
	_, err := db.NewInsert().Model(inst).Returning("id").Exec(context.Background(), inst)
	if err != nil {
		t.Fatalf("seed instrument %s: %v", inst.Symbol, err)
	}
}

// seedCoverage inserts a single coverage row.
func seedCoverage(t *testing.T, db *bun.DB, cov *model.MarketDataPackCoverage) {
	t.Helper()
	// Insert the parent pack first if it doesn't exist to satisfy foreign key
	_, err := db.NewInsert().
		Model(&model.MarketDataPack{
			ID:            cov.PackID,
			Version:       "1.0.0",
			Name:          "Test Pack",
			FormatVersion: 1,
			Status:        "installed",
			FilePath:      "/tmp/test",
			Checksum:      "dummy",
		}).
		On("CONFLICT (id) DO NOTHING").
		Exec(context.Background())
	if err != nil {
		t.Fatalf("seed parent pack %s: %v", cov.PackID, err)
	}

	_, err = db.NewInsert().Model(cov).Exec(context.Background())
	if err != nil {
		t.Fatalf("seed coverage %s: %v", cov.Symbol, err)
	}
}

// countBridged returns how many coverage rows for a pack have pack_instrument_id set.
func countBridged(t *testing.T, db *bun.DB, packID string) int {
	t.Helper()
	var n int
	err := db.QueryRowContext(context.Background(),
		`SELECT COUNT(*) FROM sigma_finance.market_data_pack_coverage
		 WHERE pack_id = ? AND pack_instrument_id IS NOT NULL`, packID).Scan(&n)
	if err != nil {
		t.Fatalf("count bridged: %v", err)
	}
	return n
}

// emptyJSON returns a JSON null array for seeding coverage FilePaths.
func emptyJSON() json.RawMessage {
	return json.RawMessage("[]")
}

// TestBridgeCoverage_StockSuffixStrip verifies that coverage rows with
// exchange-suffixed symbols (e.g. AAPL.US) are bridged to instruments
// whose normalized_symbol matches the stripped base symbol.
func TestBridgeCoverage_StockSuffixStrip(t *testing.T) {
	db, cleanup, err := setupBridgeDB(t)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer cleanup()

	ctx := context.Background()
	now := time.Now()
	packID := "test-stock-pack"
	packInstID := "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1"

	// Seed a DB instrument (no suffix)
	aapl := &model.Instrument{
		Symbol:           "AAPL",
		NormalizedSymbol: "AAPL",
		Name:             "Apple Inc.",
		NormalizedName:   "apple inc.",
		Exchange:         "NASDAQ",
		AssetType:        model.InstrumentAssetTypeStock,
		Status:           model.InstrumentStatusActive,
		ProviderSource:   "financedatabase",
		FirstSeenAt:      now,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	seedInstrument(t, db, aapl)

	// Seed an unbridged coverage row with the STOOQ-style suffix
	cov := &model.MarketDataPackCoverage{
		PackID:       packID,
		InstrumentID: packInstID, // pack-generated UUID (not DB instrument ID)
		Symbol:       "AAPL.US",
		AssetType:    "STOCK",
		Interval:     "1D",
		FirstDate:    now.AddDate(-1, 0, 0),
		LastDate:     now,
		RowCount:     250,
		FilePaths:    emptyJSON(),
	}
	seedCoverage(t, db, cov)

	repo := NewMarketDataPackRepository(db)

	if err := repo.BridgeCoverage(ctx, packID); err != nil {
		t.Fatalf("BridgeCoverage: %v", err)
	}

	if n := countBridged(t, db, packID); n != 1 {
		t.Fatalf("expected 1 bridged row, got %d", n)
	}

	// Verify the coverage row now points to the DB instrument
	var covInstrumentID string
	var covPackInstID *string
	err = db.QueryRowContext(ctx,
		`SELECT instrument_id, pack_instrument_id FROM sigma_finance.market_data_pack_coverage
		 WHERE pack_id = ? AND symbol = 'AAPL.US'`, packID).Scan(&covInstrumentID, &covPackInstID)
	if err != nil {
		t.Fatalf("query coverage row: %v", err)
	}

	if covInstrumentID != aapl.ID {
		t.Fatalf("expected instrument_id %s, got %s", aapl.ID, covInstrumentID)
	}
	if covPackInstID == nil || *covPackInstID != packInstID {
		t.Fatalf("expected pack_instrument_id %s, got %v", packInstID, covPackInstID)
	}

	t.Logf("✅ Stock suffix strip: AAPL.US → DB instrument %s", aapl.ID[:8]+"...")
}

// TestBridgeCoverage_CryptoExactMatch verifies that crypto coverage rows
// are bridged when base+quote concatenation matches the coverage symbol exactly.
func TestBridgeCoverage_CryptoExactMatch(t *testing.T) {
	db, cleanup, err := setupBridgeDB(t)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer cleanup()

	ctx := context.Background()
	now := time.Now()
	packID := "test-crypto-pack"
	packInstID := "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee2"

	// Seed a crypto instrument with base/quote currency
	btc := &model.Instrument{
		Symbol:           "BTC",
		NormalizedSymbol: "BTC",
		Name:             "Bitcoin",
		NormalizedName:   "bitcoin",
		Exchange:         "BINANCE",
		AssetType:        model.InstrumentAssetTypeCrypto,
		Status:           model.InstrumentStatusActive,
		ProviderSource:   "financedatabase",
		BaseCurrency:     strPtr("BTC"),
		QuoteCurrency:    strPtr("USDT"),
		FirstSeenAt:      now,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	seedInstrument(t, db, btc)

	// Coverage row with Binance-style concatenated symbol
	cov := &model.MarketDataPackCoverage{
		PackID:       packID,
		InstrumentID: packInstID,
		Symbol:       "BTCUSDT",
		AssetType:    "CRYPTO",
		Interval:     "1D",
		FirstDate:    now.AddDate(-1, 0, 0),
		LastDate:     now,
		RowCount:     365,
		FilePaths:    emptyJSON(),
	}
	seedCoverage(t, db, cov)

	repo := NewMarketDataPackRepository(db)
	if err := repo.BridgeCoverage(ctx, packID); err != nil {
		t.Fatalf("BridgeCoverage: %v", err)
	}

	if n := countBridged(t, db, packID); n != 1 {
		t.Fatalf("expected 1 bridged row, got %d", n)
	}

	var covInstrumentID string
	var covPackInstID *string
	err = db.QueryRowContext(ctx,
		`SELECT instrument_id, pack_instrument_id FROM sigma_finance.market_data_pack_coverage
		 WHERE pack_id = ? AND symbol = 'BTCUSDT'`, packID).Scan(&covInstrumentID, &covPackInstID)
	if err != nil {
		t.Fatalf("query coverage row: %v", err)
	}

	if covInstrumentID != btc.ID {
		t.Fatalf("expected instrument_id %s, got %s", btc.ID, covInstrumentID)
	}
	if covPackInstID == nil || *covPackInstID != packInstID {
		t.Fatalf("expected pack_instrument_id %s, got %v", packInstID, covPackInstID)
	}

	t.Logf("✅ Crypto exact: BTCUSDT → DB instrument %s", btc.ID[:8]+"...")
}

// TestBridgeCoverage_CryptoPrefixFallback verifies the LIKE 'base%' fallback
// when the quote currency in coverage doesn't exactly match the DB instrument.
func TestBridgeCoverage_CryptoPrefixFallback(t *testing.T) {
	db, cleanup, err := setupBridgeDB(t)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer cleanup()

	ctx := context.Background()
	now := time.Now()
	packID := "test-crypto-fallback-pack"
	packInstID := "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee3"

	// DB instrument has BTC/USD, but coverage has BTCUSDT
	btc := &model.Instrument{
		Symbol:           "BTC",
		NormalizedSymbol: "BTC",
		Name:             "Bitcoin",
		NormalizedName:   "bitcoin",
		Exchange:         "BINANCE",
		AssetType:        model.InstrumentAssetTypeCrypto,
		Status:           model.InstrumentStatusActive,
		ProviderSource:   "financedatabase",
		BaseCurrency:     strPtr("BTC"),
		QuoteCurrency:    strPtr("USD"),
		FirstSeenAt:      now,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	seedInstrument(t, db, btc)

	cov := &model.MarketDataPackCoverage{
		PackID:       packID,
		InstrumentID: packInstID,
		Symbol:       "BTCUSDT", // different quote than DB
		AssetType:    "CRYPTO",
		Interval:     "1D",
		FirstDate:    now.AddDate(-1, 0, 0),
		LastDate:     now,
		RowCount:     365,
		FilePaths:    emptyJSON(),
	}
	seedCoverage(t, db, cov)

	repo := NewMarketDataPackRepository(db)
	if err := repo.BridgeCoverage(ctx, packID); err != nil {
		t.Fatalf("BridgeCoverage: %v", err)
	}

	if n := countBridged(t, db, packID); n != 1 {
		t.Fatalf("expected 1 bridged row via LIKE fallback, got %d", n)
	}

	t.Logf("✅ Crypto prefix fallback: BTCUSDT matched via LIKE 'btc%%' → DB instrument %s", btc.ID[:8]+"...")
}

// TestBridgeCoverage_CurrencyExactMatch verifies FX currency pairs are bridged
// by exact base+quote concatenation.
func TestBridgeCoverage_CurrencyExactMatch(t *testing.T) {
	db, cleanup, err := setupBridgeDB(t)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer cleanup()

	ctx := context.Background()
	now := time.Now()
	packID := "test-fx-pack"
	packInstID := "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee4"

	eurusd := &model.Instrument{
		Symbol:           "EURUSD",
		NormalizedSymbol: "EURUSD",
		Name:             "Euro / US Dollar",
		NormalizedName:   "euro us dollar",
		Exchange:         "FOREX",
		AssetType:        model.InstrumentAssetTypeCurrency,
		Status:           model.InstrumentStatusActive,
		ProviderSource:   "financedatabase",
		BaseCurrency:     strPtr("EUR"),
		QuoteCurrency:    strPtr("USD"),
		FirstSeenAt:      now,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	seedInstrument(t, db, eurusd)

	cov := &model.MarketDataPackCoverage{
		PackID:       packID,
		InstrumentID: packInstID,
		Symbol:       "EURUSD",
		AssetType:    "CURRENCY",
		Interval:     "1D",
		FirstDate:    now.AddDate(-1, 0, 0),
		LastDate:     now,
		RowCount:     260,
		FilePaths:    emptyJSON(),
	}
	seedCoverage(t, db, cov)

	repo := NewMarketDataPackRepository(db)
	if err := repo.BridgeCoverage(ctx, packID); err != nil {
		t.Fatalf("BridgeCoverage: %v", err)
	}

	if n := countBridged(t, db, packID); n != 1 {
		t.Fatalf("expected 1 bridged row, got %d", n)
	}

	var covInstrumentID string
	var covPackInstID *string
	err = db.QueryRowContext(ctx,
		`SELECT instrument_id, pack_instrument_id FROM sigma_finance.market_data_pack_coverage
		 WHERE pack_id = ? AND symbol = 'EURUSD'`, packID).Scan(&covInstrumentID, &covPackInstID)
	if err != nil {
		t.Fatalf("query coverage row: %v", err)
	}

	if covInstrumentID != eurusd.ID {
		t.Fatalf("expected instrument_id %s, got %s", eurusd.ID, covInstrumentID)
	}
	if covPackInstID == nil || *covPackInstID != packInstID {
		t.Fatalf("expected pack_instrument_id %s, got %v", packInstID, covPackInstID)
	}

	t.Logf("✅ Currency exact: EURUSD → DB instrument %s", eurusd.ID[:8]+"...")
}

// TestBridgeCoverage_NoMatches verifies that coverage rows with no matching
// instrument are left unbridged (pack_instrument_id stays NULL) and no error occurs.
func TestBridgeCoverage_NoMatches(t *testing.T) {
	db, cleanup, err := setupBridgeDB(t)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer cleanup()

	ctx := context.Background()
	now := time.Now()
	packID := "test-nomatch-pack"
	packInstID := "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee5"

	// Coverage for a symbol with no matching instrument
	cov := &model.MarketDataPackCoverage{
		PackID:       packID,
		InstrumentID: packInstID,
		Symbol:       "NONEXISTENT.FAKE",
		AssetType:    "STOCK",
		Interval:     "1D",
		FirstDate:    now.AddDate(-1, 0, 0),
		LastDate:     now,
		RowCount:     50,
		FilePaths:    emptyJSON(),
	}
	seedCoverage(t, db, cov)

	repo := NewMarketDataPackRepository(db)
	if err := repo.BridgeCoverage(ctx, packID); err != nil {
		t.Fatalf("BridgeCoverage should not error on unmatched rows: %v", err)
	}

	// Should still have 0 bridged rows
	if n := countBridged(t, db, packID); n != 0 {
		t.Fatalf("expected 0 bridged rows for unmatched symbol, got %d", n)
	}

	t.Logf("✅ No matches: unmatched row left unbridged")
}

// TestBridgeCoverage_Idempotent verifies that BridgeCoverage is safe to re-run:
// already-bridged rows (with pack_instrument_id set) are not modified.
func TestBridgeCoverage_Idempotent(t *testing.T) {
	db, cleanup, err := setupBridgeDB(t)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer cleanup()

	ctx := context.Background()
	now := time.Now()
	packID := "test-idempotent-pack"

	aapl := &model.Instrument{
		Symbol:           "AAPL",
		NormalizedSymbol: "AAPL",
		Name:             "Apple Inc.",
		NormalizedName:   "apple inc.",
		Exchange:         "NASDAQ",
		AssetType:        model.InstrumentAssetTypeStock,
		Status:           model.InstrumentStatusActive,
		ProviderSource:   "financedatabase",
		FirstSeenAt:      now,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	seedInstrument(t, db, aapl)

	// Pre-bridge the row manually (simulate previous bridging)
	packInstID := "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee6"
	cov := &model.MarketDataPackCoverage{
		PackID:           packID,
		InstrumentID:     aapl.ID, // already bridged
		PackInstrumentID: strPtr(packInstID),
		Symbol:           "AAPL.US",
		AssetType:        "STOCK",
		Interval:         "1D",
		FirstDate:        now.AddDate(-1, 0, 0),
		LastDate:         now,
		RowCount:         250,
		FilePaths:        emptyJSON(),
	}
	seedCoverage(t, db, cov)

	// Also add an unbridged row that should be bridged
	packInstID2 := "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee7"
	cov2 := &model.MarketDataPackCoverage{
		PackID:       packID,
		InstrumentID: packInstID2,
		Symbol:       "AAPL.USX", // won't match, but test structure
		AssetType:    "STOCK",
		Interval:     "1D",
		FirstDate:    now.AddDate(-1, 0, 0),
		LastDate:     now,
		RowCount:     100,
		FilePaths:    emptyJSON(),
	}
	seedCoverage(t, db, cov2)

	repo := NewMarketDataPackRepository(db)
	if err := repo.BridgeCoverage(ctx, packID); err != nil {
		t.Fatalf("first BridgeCoverage: %v", err)
	}

	bridgedAfterFirst := countBridged(t, db, packID)

	// Run again — should be idempotent
	if err := repo.BridgeCoverage(ctx, packID); err != nil {
		t.Fatalf("second BridgeCoverage: %v", err)
	}

	bridgedAfterSecond := countBridged(t, db, packID)

	if bridgedAfterSecond != bridgedAfterFirst {
		t.Fatalf("expected idempotent: first=%d bridged, second=%d bridged — should be equal",
			bridgedAfterFirst, bridgedAfterSecond)
	}

	// Verify the already-bridged row still has its original values
	var covInstrumentID string
	var covPackInstID *string
	err = db.QueryRowContext(ctx,
		`SELECT instrument_id, pack_instrument_id FROM sigma_finance.market_data_pack_coverage
		 WHERE pack_id = ? AND symbol = 'AAPL.US'`, packID).Scan(&covInstrumentID, &covPackInstID)
	if err != nil {
		t.Fatalf("query original bridged row: %v", err)
	}

	if covInstrumentID != aapl.ID {
		t.Fatalf("already-bridged row instrument_id changed: expected %s, got %s", aapl.ID, covInstrumentID)
	}
	if covPackInstID == nil || *covPackInstID != packInstID {
		t.Fatalf("already-bridged row pack_instrument_id changed: expected %s, got %v", packInstID, covPackInstID)
	}

	t.Logf("✅ Idempotent: already-bridged row preserved, count stable at %d", bridgedAfterFirst)
}

// TestBridgeCoverage_MultipleStrategies verifies that a single pack containing
// stock, crypto, and currency coverage rows bridges all three correctly.
func TestBridgeCoverage_MultipleStrategies(t *testing.T) {
	db, cleanup, err := setupBridgeDB(t)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer cleanup()

	ctx := context.Background()
	now := time.Now()
	packID := "test-multi-pack"

	// Stock instrument
	goog := &model.Instrument{
		Symbol:           "GOOGL",
		NormalizedSymbol: "GOOGL",
		Name:             "Alphabet Inc.",
		NormalizedName:   "alphabet inc.",
		Exchange:         "NASDAQ",
		AssetType:        model.InstrumentAssetTypeStock,
		Status:           model.InstrumentStatusActive,
		ProviderSource:   "financedatabase",
		FirstSeenAt:      now,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	seedInstrument(t, db, goog)

	// Crypto instrument
	eth := &model.Instrument{
		Symbol:           "ETH",
		NormalizedSymbol: "ETH",
		Name:             "Ethereum",
		NormalizedName:   "ethereum",
		Exchange:         "BINANCE",
		AssetType:        model.InstrumentAssetTypeCrypto,
		Status:           model.InstrumentStatusActive,
		ProviderSource:   "financedatabase",
		BaseCurrency:     strPtr("ETH"),
		QuoteCurrency:    strPtr("USDT"),
		FirstSeenAt:      now,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	seedInstrument(t, db, eth)

	// Currency instrument
	gbpusd := &model.Instrument{
		Symbol:           "GBPUSD",
		NormalizedSymbol: "GBPUSD",
		Name:             "British Pound / US Dollar",
		NormalizedName:   "british pound us dollar",
		Exchange:         "FOREX",
		AssetType:        model.InstrumentAssetTypeCurrency,
		Status:           model.InstrumentStatusActive,
		ProviderSource:   "financedatabase",
		BaseCurrency:     strPtr("GBP"),
		QuoteCurrency:    strPtr("USD"),
		FirstSeenAt:      now,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	seedInstrument(t, db, gbpusd)

	// Seed coverage rows for all three types
	covs := []model.MarketDataPackCoverage{
		{PackID: packID, InstrumentID: "11111111-1111-4111-8111-111111111111", Symbol: "GOOGL.US", AssetType: "STOCK", Interval: "1D", FirstDate: now.AddDate(-1, 0, 0), LastDate: now, RowCount: 250, FilePaths: emptyJSON()},
		{PackID: packID, InstrumentID: "22222222-2222-4222-8222-222222222222", Symbol: "ETHUSDT", AssetType: "CRYPTO", Interval: "1D", FirstDate: now.AddDate(-1, 0, 0), LastDate: now, RowCount: 365, FilePaths: emptyJSON()},
		{PackID: packID, InstrumentID: "33333333-3333-4333-8333-333333333333", Symbol: "GBPUSD", AssetType: "CURRENCY", Interval: "1D", FirstDate: now.AddDate(-1, 0, 0), LastDate: now, RowCount: 260, FilePaths: emptyJSON()},
		// Unmatchable row — should be left alone
		{PackID: packID, InstrumentID: "44444444-4444-4444-8444-444444444444", Symbol: "ZZZZZ.XX", AssetType: "STOCK", Interval: "1D", FirstDate: now.AddDate(-1, 0, 0), LastDate: now, RowCount: 10, FilePaths: emptyJSON()},
	}
	for i := range covs {
		seedCoverage(t, db, &covs[i])
	}

	repo := NewMarketDataPackRepository(db)
	if err := repo.BridgeCoverage(ctx, packID); err != nil {
		t.Fatalf("BridgeCoverage: %v", err)
	}

	// 3 of 4 rows should be bridged
	if n := countBridged(t, db, packID); n != 3 {
		t.Fatalf("expected 3 bridged rows, got %d", n)
	}

	// Verify individual bridged rows
	type check struct {
		symbol       string
		expectedInst string
	}
	checks := []check{
		{"GOOGL.US", goog.ID},
		{"ETHUSDT", eth.ID},
		{"GBPUSD", gbpusd.ID},
	}
	for _, c := range checks {
		var instID string
		var packInstID *string
		err := db.QueryRowContext(ctx,
			`SELECT instrument_id, pack_instrument_id FROM sigma_finance.market_data_pack_coverage
			 WHERE pack_id = ? AND symbol = ?`, packID, c.symbol).Scan(&instID, &packInstID)
		if err != nil {
			t.Fatalf("query %s: %v", c.symbol, err)
		}
		if instID != c.expectedInst {
			t.Fatalf("%s: expected instrument_id %s, got %s", c.symbol, c.expectedInst[:8]+"...", instID[:8]+"...")
		}
		if packInstID == nil || strings.TrimSpace(*packInstID) == "" {
			t.Fatalf("%s: expected pack_instrument_id to be set", c.symbol)
		}
	}

	// Verify unmatched row is still unbridged
	var unmatchedPackInstID *string
	err = db.QueryRowContext(ctx,
		`SELECT pack_instrument_id FROM sigma_finance.market_data_pack_coverage
		 WHERE pack_id = ? AND symbol = 'ZZZZZ.XX'`, packID).Scan(&unmatchedPackInstID)
	if err != nil {
		t.Fatalf("query unmatched: %v", err)
	}
	if unmatchedPackInstID != nil {
		t.Fatalf("unmatched row should have NULL pack_instrument_id, got %v", *unmatchedPackInstID)
	}

	t.Logf("✅ Multiple strategies: 3/4 bridged (stock+crypto+currency), 1 unmatched left alone")
}

// TestBridgeCoverage_EmptyPack verifies that bridging an empty pack
// (no coverage rows) succeeds without error.
func TestBridgeCoverage_EmptyPack(t *testing.T) {
	db, cleanup, err := setupBridgeDB(t)
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	defer cleanup()

	ctx := context.Background()
	repo := NewMarketDataPackRepository(db)

	if err := repo.BridgeCoverage(ctx, "nonexistent-pack"); err != nil {
		t.Fatalf("BridgeCoverage on empty pack should not error: %v", err)
	}

	t.Logf("✅ Empty pack: no error")
}
