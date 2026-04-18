package repository

import (
	"testing"

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
