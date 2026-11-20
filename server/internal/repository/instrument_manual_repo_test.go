package repository

import (
	"context"
	"fmt"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/testutil"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/uptrace/bun"
)

func repoPtrString(value string) *string {
	return &value
}

const (
	repoTestOwnerOne = "11111111-1111-1111-1111-111111111111"
	repoTestOwnerTwo = "22222222-2222-2222-2222-222222222222"
)

// Search and SearchBaseline may be bound to a transaction, which owns a single
// connection. Concurrent queries on it desynchronise the Postgres protocol
// ("unexpected message 'T'"), so both must stay sequential.
func TestInstrumentRepository_SearchWithinTransaction(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	_, err := testDB.DB.ExecContext(ctx, `
		DELETE FROM sigma_finance.instrument_aliases;
		DELETE FROM sigma_finance.instrument_sync_state;
		DELETE FROM sigma_finance.instruments;
	`)
	require.NoError(t, err)

	repo := NewInstrumentRepository(testDB.DB)
	_, err = repo.Create(ctx, &model.Instrument{
		Symbol:           "AAPL",
		NormalizedSymbol: "AAPL",
		Name:             "Apple Inc.",
		NormalizedName:   "apple inc",
		Exchange:         "NASDAQ",
		AssetType:        model.InstrumentAssetTypeStock,
		Status:           model.InstrumentStatusActive,
		ProviderSource:   "test",
	})
	require.NoError(t, err)

	err = testDB.DB.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		txRepo := NewInstrumentRepository(tx)
		for i := 0; i < 5; i++ {
			rows, searchErr := txRepo.Search(ctx, "AAPL", InstrumentSearchFilter{Limit: 10})
			if searchErr != nil {
				return fmt.Errorf("Search iteration %d: %w", i, searchErr)
			}
			if len(rows) == 0 {
				return fmt.Errorf("Search iteration %d returned no rows", i)
			}

			rows, searchErr = txRepo.SearchBaseline(ctx, "AAPL", InstrumentSearchFilter{Limit: 10})
			if searchErr != nil {
				return fmt.Errorf("SearchBaseline iteration %d: %w", i, searchErr)
			}
			if len(rows) == 0 {
				return fmt.Errorf("SearchBaseline iteration %d returned no rows", i)
			}
		}
		return nil
	})
	require.NoError(t, err)
}

func TestInstrumentRepository_ListManual(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	_, err := testDB.DB.ExecContext(ctx, `
		DELETE FROM sigma_finance.instrument_aliases;
		DELETE FROM sigma_finance.instrument_sync_state;
		DELETE FROM sigma_finance.instruments;
	`)
	require.NoError(t, err)

	repo := NewInstrumentRepository(testDB.DB)

	active := &model.Instrument{
		Symbol:           "AAA",
		NormalizedSymbol: "AAA",
		Name:             "Alpha Asset",
		NormalizedName:   "alpha asset",
		Exchange:         "NYSE",
		AssetType:        model.InstrumentAssetTypeStock,
		Status:           model.InstrumentStatusUnknown,
		ProviderSource:   "manual",
		OwnerUserID:      repoPtrString(repoTestOwnerOne),
		ISIN:             repoPtrString("US0378331005"),
		CUSIP:            repoPtrString("037833100"),
		FIGI:             repoPtrString("BBG000B9Y5X2"),
	}
	archived := &model.Instrument{
		Symbol:           "BBB",
		NormalizedSymbol: "BBB",
		Name:             "Beta Asset",
		NormalizedName:   "beta asset",
		Exchange:         "NYSE",
		AssetType:        model.InstrumentAssetTypeStock,
		Status:           model.InstrumentStatusArchived,
		ProviderSource:   "manual",
		OwnerUserID:      repoPtrString(repoTestOwnerTwo),
	}

	_, err = repo.Create(ctx, active)
	require.NoError(t, err)
	_, err = repo.Create(ctx, archived)
	require.NoError(t, err)

	rows, err := repo.ListManual(ctx, ManualInstrumentFilter{Limit: 10, Offset: 0, OwnerUserID: repoPtrString(repoTestOwnerOne)})
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, "AAA", rows[0].Symbol)
	require.Equal(t, model.InstrumentStatusUnknown, rows[0].Status)

	rows, err = repo.ListManual(ctx, ManualInstrumentFilter{Limit: 10, Offset: 0, IncludeArchived: true, OwnerUserID: repoPtrString(repoTestOwnerTwo)})
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, "BBB", rows[0].Symbol)

	searchRows, err := repo.searchExactSymbolInstruments(ctx, "AAA", InstrumentSearchFilter{}, 10)
	require.NoError(t, err)
	require.Len(t, searchRows, 1)
	require.Equal(t, "AAA", searchRows[0].Instrument.Symbol)

	visibleRows := filterVisibleInstrumentSearchRows(searchRows, repoPtrString(repoTestOwnerOne))
	require.Len(t, visibleRows, 1)
	require.Equal(t, "AAA", visibleRows[0].Instrument.Symbol)

	visibleRows = filterVisibleInstrumentSearchRows(searchRows, repoPtrString(repoTestOwnerTwo))
	require.Len(t, visibleRows, 0)

	// Test matching by ISIN
	isinRows, err := repo.searchExactSymbolInstruments(ctx, "US0378331005", InstrumentSearchFilter{}, 10)
	require.NoError(t, err)
	require.Len(t, isinRows, 1)
	require.Equal(t, "AAA", isinRows[0].Instrument.Symbol)

	// Test matching by CUSIP
	cusipRows, err := repo.searchExactSymbolInstruments(ctx, "037833100", InstrumentSearchFilter{}, 10)
	require.NoError(t, err)
	require.Len(t, cusipRows, 1)
	require.Equal(t, "AAA", cusipRows[0].Instrument.Symbol)

	// Test matching by FIGI
	figiRows, err := repo.searchExactSymbolInstruments(ctx, "BBG000B9Y5X2", InstrumentSearchFilter{}, 10)
	require.NoError(t, err)
	require.Len(t, figiRows, 1)
	require.Equal(t, "AAA", figiRows[0].Instrument.Symbol)
}
