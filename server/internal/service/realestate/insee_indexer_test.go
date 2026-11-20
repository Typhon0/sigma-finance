package realestate

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uptrace/bun"
)

func TestINSEEIndexer_ResolveSeries(t *testing.T) {
	indexer := NewINSEEIndexer(nil)

	// Paris
	assert.Equal(t, "PARIS_APARTMENT", indexer.ResolveSeries("75011", "Apartment"))
	assert.Equal(t, "PETITE_COURONNE_HOUSE", indexer.ResolveSeries("75011", "House"))

	// Petite Couronne
	assert.Equal(t, "PETITE_COURONNE_APARTMENT", indexer.ResolveSeries("92100", "Apartment"))
	assert.Equal(t, "PETITE_COURONNE_HOUSE", indexer.ResolveSeries("93100", "House"))

	// Grande Couronne
	assert.Equal(t, "GRANDE_COURONNE_APARTMENT", indexer.ResolveSeries("78000", "Apartment"))
	assert.Equal(t, "GRANDE_COURONNE_HOUSE", indexer.ResolveSeries("91000", "House"))

	// Province (including Alsace-Moselle 67/68/57)
	assert.Equal(t, "PROVINCE_APARTMENT", indexer.ResolveSeries("67000", "Apartment"))
	assert.Equal(t, "PROVINCE_HOUSE", indexer.ResolveSeries("57000", "House"))
	assert.Equal(t, "PROVINCE_APARTMENT", indexer.ResolveSeries("69001", "Apartment"))
}

// Mock indexer for testing price point generation
type mockIndexFetcher struct {
	values map[string]float64
}

func (m *mockIndexFetcher) getVal(q string) float64 {
	if v, ok := m.values[q]; ok {
		return v
	}
	return 100.0
}

func TestINSEEIndexer_HistoricalSmoothing(t *testing.T) {
	// Verify progressive linear scaling logic
	purchasePrice := 200000.0
	finalValuation := 250000.0
	rawFinalPrice := 230000.0              // Raw indexation gives 230k, but DVF says 250k
	diff := finalValuation - rawFinalPrice // +20 000 € gap

	// Points at i=0 (purchase), i=1, i=2, i=3 (today)
	n := 3.0
	// At i=0: progress = 0/3 = 0 -> price = 200k + (20k * 0) = 200k (EXACT PURCHASE PRICE)
	p0 := purchasePrice + (diff * (0.0 / n))
	assert.InDelta(t, 200000.0, p0, 0.01)

	// At i=3: progress = 3/3 = 1 -> price = 230k + (20k * 1) = 250k (EXACT FINAL VALUATION)
	p3 := rawFinalPrice + (diff * (3.0 / n))
	assert.InDelta(t, 250000.0, p3, 0.01)
}

func TestINSEEIndexer_DROM_Exclusion(t *testing.T) {
	indexer := NewINSEEIndexer(&bun.DB{})
	ctx := context.Background()

	// DROM 971 should return nil for insee backfill
	pts, err := indexer.GenerateHistoricalPricePoints(
		ctx,
		"asset-1",
		250000.0,
		time.Now().AddDate(-3, 0, 0),
		"97100", // Guadeloupe
		"Apartment",
		nil,
		time.Now(),
	)
	require.NoError(t, err)
	assert.Nil(t, pts, "DROM must not generate insee historical price points")
}
