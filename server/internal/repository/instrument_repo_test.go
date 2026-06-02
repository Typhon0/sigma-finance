package repository

import (
	"context"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
)

func TestBuildTickerCandidatesIncludesSingleCharacterReplacement(t *testing.T) {
	candidates := buildTickerCandidates("APPL")

	found := false
	for _, candidate := range candidates {
		if candidate == "AAPL" {
			found = true
			break
		}
	}

	if !found {
		t.Fatalf("expected ticker typo candidates to include AAPL, got %v", candidates)
	}
}

func TestScoreInstrumentMatchRewardsNearSymbolTypos(t *testing.T) {
	instrument := model.Instrument{
		NormalizedSymbol: "AAPL",
		NormalizedName:   "apple inc",
		Status:           model.InstrumentStatusActive,
	}

	score := scoreInstrumentMatch("APPL", "appl", instrument, nil)
	if score < 900 {
		t.Fatalf("expected near symbol typo score to be strong, got %v", score)
	}
}

func TestIsTickerLikeQuery(t *testing.T) {
	if !isTickerLikeQuery("AAPL") {
		t.Fatal("expected AAPL to be recognized as ticker-like")
	}
	if isTickerLikeQuery("apple inc") {
		t.Fatal("expected spaced text to not be recognized as ticker-like")
	}
}

// TestSearch_TickerExactReturnsApple is a regression test for the bug where
// searching the exact ticker symbol "AAPL" returned no results. The root cause
// was that the ticker-candidate IN clause was AND-ed with the symbol-match
// condition, so LIKE 'AAPL%' matched "AAPL.US" (from Stooq) but the
// same-length candidate IN ('AAPL',...) did not — both had to pass, zeroing
// out the row. The fix OR-ed them together so either branch is sufficient.
//
// This test reproduces the exact scenario by seeding an instrument with
// NormalizedSymbol "AAPL.US" (Stooq-style exchange suffix) and verifying that
// searching for the bare ticker "AAPL" still finds it via the LIKE prefix path.
func TestSearch_TickerExactReturnsApple(t *testing.T) {
	db, cleanup, err := setupBenchDB()
	if err != nil {
		t.Fatalf("setup bench DB: %v", err)
		return
	}
	defer cleanup()

	ctx := context.Background()

	// Seed an additional instrument with Stooq-style suffixed normalized_symbol.
	// This reproduces the exact regression: LIKE 'AAPL%' matches "AAPL.US"
	// but the same-length candidate IN ('AAPL',...) does not — the fix OR-s
	// them so the LIKE branch alone suffices.
	now := time.Now()
	suffixed := &model.Instrument{
		Symbol:           "AAPL",
		NormalizedSymbol: "AAPL.US",
		Name:             "Apple Inc.",
		NormalizedName:   "apple inc.",
		Exchange:         "NASDAQ",
		AssetType:        model.InstrumentAssetTypeStock,
		Status:           model.InstrumentStatusActive,
		ProviderSource:   "stooq",
		FirstSeenAt:      now,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	if _, err := db.NewInsert().Model(suffixed).Exec(ctx); err != nil {
		t.Fatalf("seed suffixed instrument: %v", err)
	}

	repo := NewInstrumentRepository(db)
	filter := InstrumentSearchFilter{Limit: 5}

	results, err := repo.Search(ctx, "AAPL", filter)
	if err != nil {
		t.Fatalf("search AAPL: %v", err)
	}

	if len(results) == 0 {
		t.Fatal("search AAPL returned no results")
	}

	top := results[0]
	if top.Instrument.Symbol != "AAPL" {
		t.Fatalf("expected top result symbol AAPL, got %q", top.Instrument.Symbol)
	}
	if top.Instrument.Name != "Apple Inc." {
		t.Fatalf("expected top result name 'Apple Inc.', got %q", top.Instrument.Name)
	}
}
