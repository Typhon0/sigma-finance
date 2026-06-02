package repository

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"sigma_finance/internal/config"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// setupBenchDB creates a test DB connection and seeds instruments for benchmarking.
// Returns the DB, cleanup function, and error.
func setupBenchDB() (*bun.DB, func(), error) {
	db, err := config.NewTestDB()
	if err != nil {
		return nil, nil, fmt.Errorf("connect to test DB: %w", err)
	}

	ctx := context.Background()
	cleanup := func() {
		// Truncate seeded data
		_, _ = db.NewRaw("TRUNCATE TABLE sigma_finance.instruments CASCADE").Exec(ctx)
		db.Close()
	}

	// Clean up any leftover data
	_, _ = db.NewRaw("TRUNCATE TABLE sigma_finance.instruments CASCADE").Exec(ctx)

	// Seed 50 well-known instruments for realistic search volume
	seedInstruments := []struct {
		symbol, name, exchange string
		assetType              model.InstrumentAssetType
		rank                   int
		sector                 string
		industry               string
	}{
		// Major stocks
		{"AAPL", "Apple Inc.", "NASDAQ", model.InstrumentAssetTypeStock, 3, "Technology", "Consumer Electronics"},
		{"MSFT", "Microsoft Corporation", "NASDAQ", model.InstrumentAssetTypeStock, 2, "Technology", "Software"},
		{"GOOGL", "Alphabet Inc.", "NASDAQ", model.InstrumentAssetTypeStock, 4, "Communication Services", "Internet Content"},
		{"AMZN", "Amazon.com Inc.", "NASDAQ", model.InstrumentAssetTypeStock, 5, "Consumer Cyclical", "Internet Retail"},
		{"NVDA", "NVIDIA Corporation", "NASDAQ", model.InstrumentAssetTypeStock, 1, "Technology", "Semiconductors"},
		{"META", "Meta Platforms Inc.", "NASDAQ", model.InstrumentAssetTypeStock, 7, "Communication Services", "Internet Content"},
		{"TSLA", "Tesla Inc.", "NASDAQ", model.InstrumentAssetTypeStock, 8, "Consumer Cyclical", "Auto Manufacturers"},
		{"JPM", "JPMorgan Chase & Co.", "NYSE", model.InstrumentAssetTypeStock, 10, "Financial Services", "Banks"},
		{"V", "Visa Inc.", "NYSE", model.InstrumentAssetTypeStock, 12, "Financial Services", "Credit Services"},
		{"JNJ", "Johnson & Johnson", "NYSE", model.InstrumentAssetTypeStock, 15, "Healthcare", "Drug Manufacturers"},
		{"WMT", "Walmart Inc.", "NYSE", model.InstrumentAssetTypeStock, 18, "Consumer Defensive", "Discount Stores"},
		{"PG", "Procter & Gamble Company", "NYSE", model.InstrumentAssetTypeStock, 20, "Consumer Defensive", "Household Products"},
		{"MA", "Mastercard Incorporated", "NYSE", model.InstrumentAssetTypeStock, 13, "Financial Services", "Credit Services"},
		{"UNH", "UnitedHealth Group Inc.", "NYSE", model.InstrumentAssetTypeStock, 11, "Healthcare", "Healthcare Plans"},
		{"HD", "The Home Depot Inc.", "NYSE", model.InstrumentAssetTypeStock, 22, "Consumer Cyclical", "Home Improvement Retail"},
		{"BAC", "Bank of America Corporation", "NYSE", model.InstrumentAssetTypeStock, 25, "Financial Services", "Banks"},
		{"DIS", "The Walt Disney Company", "NYSE", model.InstrumentAssetTypeStock, 30, "Communication Services", "Entertainment"},
		{"NFLX", "Netflix Inc.", "NASDAQ", model.InstrumentAssetTypeStock, 35, "Communication Services", "Entertainment"},
		{"ADBE", "Adobe Inc.", "NASDAQ", model.InstrumentAssetTypeStock, 28, "Technology", "Software"},
		{"CRM", "Salesforce Inc.", "NYSE", model.InstrumentAssetTypeStock, 32, "Technology", "Software"},
		{"AMD", "Advanced Micro Devices Inc.", "NASDAQ", model.InstrumentAssetTypeStock, 40, "Technology", "Semiconductors"},
		{"INTC", "Intel Corporation", "NASDAQ", model.InstrumentAssetTypeStock, 45, "Technology", "Semiconductors"},
		{"CSCO", "Cisco Systems Inc.", "NASDAQ", model.InstrumentAssetTypeStock, 48, "Technology", "Communication Equipment"},
		{"PEP", "PepsiCo Inc.", "NASDAQ", model.InstrumentAssetTypeStock, 38, "Consumer Defensive", "Beverages"},
		{"KO", "The Coca-Cola Company", "NYSE", model.InstrumentAssetTypeStock, 42, "Consumer Defensive", "Beverages"},
		// International / other exchanges
		{"BABA", "Alibaba Group Holding Ltd.", "NYSE", model.InstrumentAssetTypeStock, 80, "Consumer Cyclical", "Internet Retail"},
		{"TSM", "Taiwan Semiconductor Mfg. Co.", "NYSE", model.InstrumentAssetTypeStock, 9, "Technology", "Semiconductors"},
		{"SHEL", "Shell plc", "LSE", model.InstrumentAssetTypeStock, 50, "Energy", "Oil & Gas"},
		{"HSBA", "HSBC Holdings plc", "LSE", model.InstrumentAssetTypeStock, 60, "Financial Services", "Banks"},
		{"BP", "BP p.l.c.", "LSE", model.InstrumentAssetTypeStock, 55, "Energy", "Oil & Gas"},
		{"RHM", "Rheinmetall AG", "XETRA", model.InstrumentAssetTypeStock, 200, "Industrials", "Aerospace & Defense"},
		{"SAP", "SAP SE", "XETRA", model.InstrumentAssetTypeStock, 65, "Technology", "Software"},
		{"AIR", "Airbus SE", "XETRA", model.InstrumentAssetTypeStock, 100, "Industrials", "Aerospace & Defense"},
		{"7203", "Toyota Motor Corporation", "TSE", model.InstrumentAssetTypeStock, 33, "Consumer Cyclical", "Auto Manufacturers"},
		{"6758", "Sony Group Corporation", "TSE", model.InstrumentAssetTypeStock, 85, "Technology", "Consumer Electronics"},
		// ETFs
		{"SPY", "SPDR S&P 500 ETF Trust", "NYSEARCA", model.InstrumentAssetTypeETF, 0, "", ""},
		{"IVV", "iShares Core S&P 500 ETF", "NYSEARCA", model.InstrumentAssetTypeETF, 0, "", ""},
		{"QQQ", "Invesco QQQ Trust", "NASDAQ", model.InstrumentAssetTypeETF, 0, "", ""},
		{"VTI", "Vanguard Total Stock Market ETF", "NYSEARCA", model.InstrumentAssetTypeETF, 0, "", ""},
		// Cryptos
		{"BTC", "Bitcoin", "CRYPTO", model.InstrumentAssetTypeCrypto, 1, "", ""},
		{"ETH", "Ethereum", "CRYPTO", model.InstrumentAssetTypeCrypto, 2, "", ""},
		{"SOL", "Solana", "CRYPTO", model.InstrumentAssetTypeCrypto, 5, "", ""},
		{"XRP", "XRP", "CRYPTO", model.InstrumentAssetTypeCrypto, 6, "", ""},
		{"DOGE", "Dogecoin", "CRYPTO", model.InstrumentAssetTypeCrypto, 8, "", ""},
		{"ADA", "Cardano", "CRYPTO", model.InstrumentAssetTypeCrypto, 10, "", ""},
		{"DOT", "Polkadot", "CRYPTO", model.InstrumentAssetTypeCrypto, 15, "", ""},
		{"AVAX", "Avalanche", "CRYPTO", model.InstrumentAssetTypeCrypto, 12, "", ""},
		{"MATIC", "Polygon", "CRYPTO", model.InstrumentAssetTypeCrypto, 20, "", ""},
		{"LINK", "Chainlink", "CRYPTO", model.InstrumentAssetTypeCrypto, 14, "", ""},
		{"UNI", "Uniswap", "CRYPTO", model.InstrumentAssetTypeCrypto, 25, "", ""},
	}

	now := time.Now()
	for _, s := range seedInstruments {
		rank := s.rank
		inst := &model.Instrument{
			Symbol:           s.symbol,
			NormalizedSymbol: s.symbol,
			Name:             s.name,
			NormalizedName:   strings.ToLower(s.name),
			Exchange:         s.exchange,
			AssetType:        s.assetType,
			Status:           model.InstrumentStatusActive,
			ProviderSource:   "benchmark",
			MarketCapRank:    &rank,
			Sector:           strPtr(s.sector),
			Industry:         strPtr(s.industry),
			FirstSeenAt:      now,
			CreatedAt:        now,
			UpdatedAt:        now,
		}
		if _, err := db.NewInsert().Model(inst).Exec(ctx); err != nil {
			return nil, cleanup, fmt.Errorf("seed instrument %s: %w", s.symbol, err)
		}
	}

	return db, cleanup, nil
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// BenchmarkSearch_TickerExact measures performance of exact ticker symbol match.
func BenchmarkSearch_TickerExact(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{Limit: 8}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.Search(ctx, "AAPL", filter)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkSearch_TickerTypo measures performance with a near-typo (APPL → AAPL).
func BenchmarkSearch_TickerTypo(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{Limit: 8}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.Search(ctx, "APPL", filter)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkSearch_TextExact measures exact company name match.
func BenchmarkSearch_TextExact(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{Limit: 8}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.Search(ctx, "Apple Inc.", filter)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkSearch_TextPrefix measures name prefix search (search-as-you-type).
func BenchmarkSearch_TextPrefix(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{Limit: 8}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.Search(ctx, "app", filter)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkSearch_MultiWord measures multi-word query scoring (e.g. "micro tech").
func BenchmarkSearch_MultiWord(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{Limit: 8}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.Search(ctx, "micro tech", filter)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkSearch_Fuzzy measures trigram fuzzy search (e.g. "mpft" → Microsoft).
func BenchmarkSearch_Fuzzy(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{Limit: 8}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.Search(ctx, "mpft", filter)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkSearch_CryptoAssetTypeFiltered measures search scoped to crypto only.
func BenchmarkSearch_CryptoAssetTypeFiltered(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{
		Limit:      8,
		AssetTypes: []model.InstrumentAssetType{model.InstrumentAssetTypeCrypto},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.Search(ctx, "eth", filter)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkSearch_ColdStart measures search with an empty query (should return fast).
func BenchmarkSearch_ColdStart(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{Limit: 8}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.Search(ctx, "", filter)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// =============================================================================
// Isolation benchmarks — measure individual strategy costs in isolation
// =============================================================================

// BenchmarkTsvectorOnly measures tsvector full-text search cost alone.
// Query "apple" should match "Apple Inc." via prefix matching.
func BenchmarkTsvectorOnly(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{Limit: 8}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.searchTsvectorTextInstruments(ctx, "apple", filter, 8)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkTsvectorOnly_MultiWord measures tsvector with multi-word query.
func BenchmarkTsvectorOnly_MultiWord(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{Limit: 8}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.searchTsvectorTextInstruments(ctx, "micro tech", filter, 8)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkFuzzyOnly measures pg_trgm trigram search cost alone.
// Query "mpft" → "Microsoft" via trigram similarity on normalized_name.
// symbolQuery is "MPFT" (uppercased) to match real Search path;
// textQuery is "mpft" (lowercased) to match real Search path.
func BenchmarkFuzzyOnly(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{Limit: 8}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.searchFuzzyInstruments(ctx, "MPFT", "mpft", filter, 8)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkExactSymbolOnly measures exact symbol search cost alone.
func BenchmarkExactSymbolOnly(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{Limit: 8}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.searchExactSymbolInstruments(ctx, "AAPL", filter, 8)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkExactTextOnly measures exact text search cost alone.
func BenchmarkExactTextOnly(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{Limit: 8}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.searchExactTextInstruments(ctx, "apple inc.", filter, 8)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// =============================================================================
// Baseline comparison benchmarks — SearchBaseline (no tsvector) vs Search (with tsvector)
// =============================================================================

// BenchmarkBaseline_Search_TickerExact measures baseline Search (no tsvector) for ticker exact match.
func BenchmarkBaseline_Search_TickerExact(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{Limit: 8}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.SearchBaseline(ctx, "AAPL", filter)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkBaseline_Search_TickerTypo measures baseline Search (no tsvector) for ticker typo.
func BenchmarkBaseline_Search_TickerTypo(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{Limit: 8}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.SearchBaseline(ctx, "APPL", filter)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkBaseline_Search_TextExact measures baseline Search (no tsvector) for text exact match.
func BenchmarkBaseline_Search_TextExact(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{Limit: 8}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.SearchBaseline(ctx, "Apple Inc.", filter)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkBaseline_Search_TextPrefix measures baseline Search (no tsvector) for prefix search.
func BenchmarkBaseline_Search_TextPrefix(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{Limit: 8}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.SearchBaseline(ctx, "app", filter)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkBaseline_Search_MultiWord measures baseline Search (no tsvector) for multi-word query.
func BenchmarkBaseline_Search_MultiWord(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{Limit: 8}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.SearchBaseline(ctx, "micro tech", filter)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkBaseline_CryptoAssetTypeFiltered measures baseline Search (no tsvector) for
// crypto-scoped search matching the original BenchmarkSearch_CryptoAssetTypeFiltered.
func BenchmarkBaseline_CryptoAssetTypeFiltered(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{
		Limit:      8,
		AssetTypes: []model.InstrumentAssetType{model.InstrumentAssetTypeCrypto},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.SearchBaseline(ctx, "eth", filter)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkBaseline_Search_Fuzzy measures baseline Search (no tsvector) for fuzzy query.
func BenchmarkBaseline_Search_Fuzzy(b *testing.B) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		b.Fatal(err)
		return
	}
	defer cleanup()

	repo := NewInstrumentRepository(db)
	ctx := context.Background()
	filter := InstrumentSearchFilter{Limit: 8}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := repo.SearchBaseline(ctx, "mpft", filter)
		if err != nil {
			b.Fatal(err)
		}
	}
}
