package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/testutil"
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/require"
	"github.com/uptrace/bun"
)

const (
	refMetricVoo  = "11111111-1111-1111-1111-111111111111"
	refMetricVti  = "22222222-2222-2222-2222-222222222222"
	refMetricBnd  = "33333333-3333-3333-3333-333333333333"
	refMetricGone = "99999999-9999-9999-9999-999999999999"
)

// seedReferenceMetricInstrument inserts an instrument row directly, so the test
// controls the reference metrics instead of depending on Upsert's behaviour.
func seedReferenceMetricInstrument(t *testing.T, ctx context.Context, db *bun.DB, id, symbol string, expenseRatio, dividendYield any) {
	t.Helper()
	_, err := db.ExecContext(ctx, `
		INSERT INTO sigma_finance.instruments (
			id, symbol, normalized_symbol, name, normalized_name, exchange,
			asset_type, status, provider_source, expense_ratio, dividend_yield
		) VALUES (?::uuid, ?, ?, ?, ?, 'TEST', 'ETF', 'ACTIVE', 'test', ?::decimal, ?::decimal)
	`, id, symbol, symbol, symbol+" name", symbol+" name", expenseRatio, dividendYield)
	require.NoError(t, err)
}

func setupReferenceMetricInstruments(t *testing.T) (*TestDBContext, context.Context) {
	t.Helper()
	testDB := testutil.NewTestDB(t)
	t.Cleanup(testDB.Close)
	ctx := context.Background()

	_, err := testDB.DB.ExecContext(ctx, `DELETE FROM sigma_finance.instruments`)
	require.NoError(t, err)

	seedReferenceMetricInstrument(t, ctx, testDB.DB, refMetricVoo, "VOO", "0.03", "1.85")
	seedReferenceMetricInstrument(t, ctx, testDB.DB, refMetricVti, "VTI", "0.05", nil)
	seedReferenceMetricInstrument(t, ctx, testDB.DB, refMetricBnd, "BND", nil, "4.20")

	return &TestDBContext{DB: testDB.DB}, ctx
}

type TestDBContext struct {
	DB *bun.DB
}

// requireDecimal asserts a nullable decimal column equals want.
func requireDecimal(t *testing.T, got *decimal.Decimal, want string) {
	t.Helper()
	require.NotNil(t, got)
	expected, err := decimal.NewFromString(want)
	require.NoError(t, err)
	require.Truef(t, expected.Equal(*got), "got %s, want %s", got, expected)
}

func TestInstrumentRepository_FindByIDs_ReturnsOnlyRequested(t *testing.T) {
	db, ctx := setupReferenceMetricInstruments(t)
	repo := NewUnitOfWork(db.DB).Instrument()

	found, err := repo.FindByIDs(ctx, []string{refMetricVoo, refMetricBnd})
	require.NoError(t, err)
	require.Len(t, found, 2)
	require.Contains(t, found, refMetricVoo)
	require.NotContains(t, found, refMetricVti)
}

func TestInstrumentRepository_FindByIDs_CarriesReferenceMetrics(t *testing.T) {
	db, ctx := setupReferenceMetricInstruments(t)
	repo := NewUnitOfWork(db.DB).Instrument()

	found, err := repo.FindByIDs(ctx, []string{refMetricVoo, refMetricVti, refMetricBnd})
	require.NoError(t, err)
	require.Len(t, found, 3)

	// Compare numerically, not by string: DECIMAL(8,6) has no notion of
	// trailing zeros, so "4.20" comes back as "4.2".
	voo := found[refMetricVoo]
	requireDecimal(t, voo.ExpenseRatio, "0.03")
	requireDecimal(t, voo.DividendYield, "1.85")

	vti := found[refMetricVti]
	requireDecimal(t, vti.ExpenseRatio, "0.05")
	// NULL must stay NULL. A provider that has not supplied a yield is making a
	// different statement from one that supplied zero, and the client used to
	// invent a figure when it had none.
	require.Nil(t, vti.DividendYield, "a null dividend yield must not be defaulted")

	bnd := found[refMetricBnd]
	require.Nil(t, bnd.ExpenseRatio, "a null expense ratio must not be defaulted")
	requireDecimal(t, bnd.DividendYield, "4.2")
}

func TestInstrumentRepository_FindByIDs_CollapsesDuplicates(t *testing.T) {
	// A portfolio page listing the same ETF in three accounts would otherwise
	// send the same uuid as three separate bind parameters.
	db, ctx := setupReferenceMetricInstruments(t)
	repo := NewUnitOfWork(db.DB).Instrument()

	found, err := repo.FindByIDs(ctx, []string{refMetricVoo, refMetricVoo, refMetricVoo})
	require.NoError(t, err)
	require.Len(t, found, 1)
}

func TestInstrumentRepository_FindByIDs_OmitsUnresolvableIDs(t *testing.T) {
	// A deleted instrument is a normal state, not a reason to fail the render
	// of every other holding on the page.
	db, ctx := setupReferenceMetricInstruments(t)
	repo := NewUnitOfWork(db.DB).Instrument()

	found, err := repo.FindByIDs(ctx, []string{refMetricVoo, refMetricGone})
	require.NoError(t, err)
	require.Len(t, found, 1)
}

func TestInstrumentRepository_FindByIDs_ShortCircuitsOnEmptyInput(t *testing.T) {
	db, ctx := setupReferenceMetricInstruments(t)
	repo := NewUnitOfWork(db.DB).Instrument()

	found, err := repo.FindByIDs(ctx, nil)
	require.NoError(t, err)
	require.Empty(t, found)

	found, err = repo.FindByIDs(ctx, []string{})
	require.NoError(t, err)
	require.Empty(t, found)
}

func TestInstrumentRepository_FindByIDs_IgnoresEmptyStringIDs(t *testing.T) {
	// assets.instrument_id is nullable and the client has been known to send an
	// empty string; an empty uuid is not a valid argument to the IN clause.
	db, ctx := setupReferenceMetricInstruments(t)
	repo := NewUnitOfWork(db.DB).Instrument()

	found, err := repo.FindByIDs(ctx, []string{"", refMetricVoo})
	require.NoError(t, err)
	require.Len(t, found, 1)
}

func TestInstrumentRepository_Create_LeavesReferenceMetricsUnset(t *testing.T) {
	// model.Instrument carries them as nullable pointers precisely so that
	// "not known" survives the round trip instead of becoming a zero.
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()
	ctx := context.Background()

	_, err := testDB.DB.ExecContext(ctx, `DELETE FROM sigma_finance.instruments`)
	require.NoError(t, err)

	repo := NewUnitOfWork(testDB.DB).Instrument()

	created, err := repo.Create(ctx, &model.Instrument{
		Symbol:           "QQQ",
		NormalizedSymbol: "QQQ",
		Name:             "Invesco QQQ Trust",
		NormalizedName:   "invesco qqq trust",
		Exchange:         "NASDAQ",
		AssetType:        model.InstrumentAssetTypeETF,
		Status:           model.InstrumentStatusActive,
		ProviderSource:   "test",
	})
	require.NoError(t, err)
	require.Nil(t, created.ExpenseRatio)
	require.Nil(t, created.DividendYield)

	// An explicit zero must be distinguishable from an absent value.
	zero, err := decimal.NewFromString("0")
	require.NoError(t, err)
	created.ExpenseRatio = &zero
	require.NoError(t, repo.Update(ctx, created))
	require.NotNil(t, created.ExpenseRatio)
	require.Equal(t, "0", created.ExpenseRatio.String())
}
