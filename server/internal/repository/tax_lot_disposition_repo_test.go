package repository

import (
	"context"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/testutil"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/require"
)

// setupDispositionWorld seeds user → portfolio → asset → position → two open
// lots, and returns the pieces needed by disposition tests.
func setupDispositionWorld(t *testing.T) (*TestDBContext, *model.Portfolio, *model.Position) {
	t.Helper()
	testDB := testutil.NewTestDB(t)
	t.Cleanup(testDB.Close)
	ctx := context.Background()
	testDB.CleanupTables(ctx)

	uow := NewUnitOfWork(testDB.DB)

	user, err := uow.User().Create(ctx, &model.User{
		ID:            uuid.NewString(),
		Email:         "disp_" + uuid.NewString()[:8] + "@example.com",
		Name:          "Disposition Test User",
		EmailVerified: true,
	})
	require.NoError(t, err)

	portfolio, err := uow.Portfolio().Create(ctx, &model.Portfolio{
		ID:     uuid.NewString(),
		UserID: user.ID,
		Name:   "Disposition Portfolio",
	})
	require.NoError(t, err)

	asset, err := uow.Asset().Create(ctx, &model.Asset{
		ID:          uuid.NewString(),
		Type:        model.AssetTypeStock,
		Symbol:      &[]string{"DISP"}[0],
		Name:        "Disposition Test Asset",
		IsTradeable: true,
	})
	require.NoError(t, err)

	position, err := uow.Position().Create(ctx, &model.Position{
		ID:          uuid.NewString(),
		PortfolioID: portfolio.ID,
		AssetID:     asset.ID,
		Quantity:    decimal.NewFromInt(100),
	})
	require.NoError(t, err)

	return &TestDBContext{DB: testDB.DB}, portfolio, position
}

func seedOpenLot(t *testing.T, ctx context.Context, db *TestDBContext, portfolioID, positionID, assetID string, acquiredAt time.Time, qty decimal.Decimal, costPerUnit decimal.Decimal) *model.TaxLot {
	t.Helper()
	lot := &model.TaxLot{
		ID:                uuid.NewString(),
		PortfolioID:       portfolioID,
		PositionID:        positionID,
		AssetID:           assetID,
		AcquiredAt:        acquiredAt,
		InitialQuantity:   qty,
		RemainingQuantity: qty,
		CostBasisPerUnit:  costPerUnit,
		TotalCostBasis:    model.Money(qty.Mul(costPerUnit).Mul(decimal.NewFromInt(100)).IntPart()),
		Currency:          model.CurrencyUSD,
		Status:            model.TaxLotStatusOpen,
	}
	_, err := db.DB.NewInsert().Model(lot).Exec(ctx)
	require.NoError(t, err)
	return lot
}

// The disposition table round-trips: batch insert, read back by position,
// ordered by sold_at, carrying the fiscal G/L.
func TestTaxLotDispositionRepository_CreateBatchAndFindByPosition(t *testing.T) {
	db, portfolio, position := setupDispositionWorld(t)
	ctx := context.Background()
	repo := NewUnitOfWork(db.DB).TaxLotDisposition()

	lotA := seedOpenLot(t, ctx, db, portfolio.ID, position.ID, position.AssetID,
		time.Now().UTC().AddDate(0, 0, -400), decimal.NewFromInt(50), decimal.NewFromFloat(10))
	lotB := seedOpenLot(t, ctx, db, portfolio.ID, position.ID, position.AssetID,
		time.Now().UTC().AddDate(0, 0, -100), decimal.NewFromInt(50), decimal.NewFromFloat(20))

	soldAt := time.Now().UTC()
	realTx := &model.Transaction{
		ID:              uuid.NewString(),
		UserID:          portfolio.UserID,
		PositionID:      &position.ID,
		Type:            model.TransactionTypeSell,
		Amount:          -240000,
		Quantity:        &[]decimal.Decimal{decimal.NewFromInt(80)}[0],
		UnitPriceAmount: &[]decimal.Decimal{decimal.NewFromFloat(30)}[0],
		ExecutedAt:      soldAt,
	}
	_, err := db.DB.NewInsert().Model(realTx).Exec(ctx)
	require.NoError(t, err)
	txID := realTx.ID
	dispositions := []*model.TaxLotDisposition{
		{
			LotID: lotA.ID, PositionID: position.ID, PortfolioID: portfolio.ID, AssetID: position.AssetID,
			TransactionID: &txID, AcquiredAt: lotA.AcquiredAt, SoldAt: soldAt,
			Quantity: decimal.NewFromInt(50), CostBasisPerUnit: lotA.CostBasisPerUnit, SellPricePerUnit: decimal.NewFromFloat(30),
			CostBasis: 50000, Proceeds: 150000, RealizedGainLoss: 100000,
			Method: model.TaxLotMethodFIFO, HoldingPeriodDays: 400, IsLongTerm: true,
		},
		{
			LotID: lotB.ID, PositionID: position.ID, PortfolioID: portfolio.ID, AssetID: position.AssetID,
			TransactionID: &txID, AcquiredAt: lotB.AcquiredAt, SoldAt: soldAt,
			Quantity: decimal.NewFromInt(30), CostBasisPerUnit: lotB.CostBasisPerUnit, SellPricePerUnit: decimal.NewFromFloat(30),
			CostBasis: 60000, Proceeds: 90000, RealizedGainLoss: 30000,
			Method: model.TaxLotMethodFIFO, HoldingPeriodDays: 100, IsLongTerm: false,
		},
	}

	require.NoError(t, repo.CreateBatch(ctx, dispositions))

	// Empty batch is a no-op, not an error.
	require.NoError(t, repo.CreateBatch(ctx, nil))

	found, err := repo.FindByPositionID(ctx, position.ID)
	require.NoError(t, err)
	require.Len(t, found, 2)
	// Oldest disposal first (same sold_at, insertion order preserved by stable scan)
	require.Equal(t, int64(100000), int64(found[0].RealizedGainLoss))
	require.Equal(t, int64(30000), int64(found[1].RealizedGainLoss))
	require.True(t, found[0].IsLongTerm)
	require.False(t, found[1].IsLongTerm)
	require.Equal(t, model.TaxLotMethodFIFO, found[0].Method)
	require.NotNil(t, found[0].TransactionID)
	require.Equal(t, txID, *found[0].TransactionID)
}

// FindByPortfolioAndDateRange filters by sold_at window (tax-year semantics).
func TestTaxLotDispositionRepository_FindByPortfolioAndDateRange(t *testing.T) {
	db, portfolio, position := setupDispositionWorld(t)
	ctx := context.Background()
	repo := NewUnitOfWork(db.DB).TaxLotDisposition()

	lot := seedOpenLot(t, ctx, db, portfolio.ID, position.ID, position.AssetID,
		time.Now().UTC().AddDate(0, 0, -800), decimal.NewFromInt(100), decimal.NewFromFloat(10))

	dispositions := []*model.TaxLotDisposition{
		{
			LotID: lot.ID, PositionID: position.ID, PortfolioID: portfolio.ID, AssetID: position.AssetID,
			AcquiredAt: lot.AcquiredAt, SoldAt: time.Date(2026, 1, 15, 12, 0, 0, 0, time.UTC),
			Quantity: decimal.NewFromInt(40), CostBasisPerUnit: lot.CostBasisPerUnit, SellPricePerUnit: decimal.NewFromFloat(15),
			CostBasis: 40000, Proceeds: 60000, RealizedGainLoss: 20000,
			Method: model.TaxLotMethodFIFO, HoldingPeriodDays: 730, IsLongTerm: true,
		},
		{
			LotID: lot.ID, PositionID: position.ID, PortfolioID: portfolio.ID, AssetID: position.AssetID,
			AcquiredAt: lot.AcquiredAt, SoldAt: time.Date(2025, 6, 1, 12, 0, 0, 0, time.UTC),
			Quantity: decimal.NewFromInt(30), CostBasisPerUnit: lot.CostBasisPerUnit, SellPricePerUnit: decimal.NewFromFloat(15),
			CostBasis: 30000, Proceeds: 45000, RealizedGainLoss: 15000,
			Method: model.TaxLotMethodFIFO, HoldingPeriodDays: 640, IsLongTerm: true,
		},
	}
	require.NoError(t, repo.CreateBatch(ctx, dispositions))

	// Tax year 2026: sold_at >= 2026-01-01 AND < 2027-01-01
	in2026, err := repo.FindByPortfolioAndDateRange(ctx, portfolio.ID,
		time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC), time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC))
	require.NoError(t, err)
	require.Len(t, in2026, 1)
	require.Equal(t, int64(20000), int64(in2026[0].RealizedGainLoss))

	in2025, err := repo.FindByPortfolioAndDateRange(ctx, portfolio.ID,
		time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC))
	require.NoError(t, err)
	require.Len(t, in2025, 1)
	require.Equal(t, int64(15000), int64(in2025[0].RealizedGainLoss))

	// All-time
	all, err := repo.FindByPortfolioID(ctx, portfolio.ID)
	require.NoError(t, err)
	require.Len(t, all, 2)
}

// CalculateCostBasisForPosition now reads fiscal G/L from dispositions,
// not from SUM(amount) of sell transactions (which is proceeds, not gains).
func TestTransactionRepository_CalculateCostBasis_UsesDispositionsForFiscalGL(t *testing.T) {
	db, portfolio, position := setupDispositionWorld(t)
	ctx := context.Background()
	repo := NewUnitOfWork(db.DB).Transaction()

	lot := seedOpenLot(t, ctx, db, portfolio.ID, position.ID, position.AssetID,
		time.Now().UTC().AddDate(0, 0, -500), decimal.NewFromInt(100), decimal.NewFromFloat(10))

	dispositions := []*model.TaxLotDisposition{
		{
			LotID: lot.ID, PositionID: position.ID, PortfolioID: portfolio.ID, AssetID: position.AssetID,
			AcquiredAt: lot.AcquiredAt, SoldAt: time.Now().UTC().AddDate(0, 0, -30),
			Quantity: decimal.NewFromInt(50), CostBasisPerUnit: lot.CostBasisPerUnit, SellPricePerUnit: decimal.NewFromFloat(25),
			CostBasis: 50000, Proceeds: 125000, RealizedGainLoss: 75000,
			Method: model.TaxLotMethodFIFO, HoldingPeriodDays: 470, IsLongTerm: true,
		},
	}
	require.NoError(t, NewUnitOfWork(db.DB).TaxLotDisposition().CreateBatch(ctx, dispositions))

	calc, err := repo.CalculateCostBasisForPosition(ctx, position.ID)
	require.NoError(t, err)
	require.Equal(t, int64(75000), int64(calc.RealizedGainLoss), "fiscal G/L must come from dispositions, not sell proceeds")
}

// CalculateRealizedGainsForUser aggregates dispositions with a real
// short/long-term split, joined through portfolio to reach the user.
func TestTransactionRepository_CalculateRealizedGainsForUser_SplitsTermFromDispositions(t *testing.T) {
	db, portfolio, position := setupDispositionWorld(t)
	ctx := context.Background()
	repo := NewUnitOfWork(db.DB).Transaction()

	lot := seedOpenLot(t, ctx, db, portfolio.ID, position.ID, position.AssetID,
		time.Now().UTC().AddDate(0, 0, -800), decimal.NewFromInt(100), decimal.NewFromFloat(10))

	now := time.Now().UTC()
	// All three rows come from ONE sell transaction: the count must report
	// distinct transactions (1), not disposition rows (3).
	oneTx := &model.Transaction{
		ID:         uuid.NewString(),
		UserID:     portfolio.UserID,
		PositionID: &position.ID,
		Type:       model.TransactionTypeSell,
		Amount:     -125000,
		ExecutedAt: now,
	}
	_, err := db.DB.NewInsert().Model(oneTx).Exec(ctx)
	require.NoError(t, err)
	txID := oneTx.ID

	dispositions := []*model.TaxLotDisposition{
		{
			LotID: lot.ID, PositionID: position.ID, PortfolioID: portfolio.ID, AssetID: position.AssetID,
			TransactionID: &txID,
			AcquiredAt:    lot.AcquiredAt, SoldAt: now.AddDate(0, 0, -10),
			Quantity: decimal.NewFromInt(40), CostBasisPerUnit: lot.CostBasisPerUnit, SellPricePerUnit: decimal.NewFromFloat(20),
			CostBasis: 40000, Proceeds: 80000, RealizedGainLoss: 40000,
			Method: model.TaxLotMethodFIFO, HoldingPeriodDays: 790, IsLongTerm: true,
		},
		{
			LotID: lot.ID, PositionID: position.ID, PortfolioID: portfolio.ID, AssetID: position.AssetID,
			TransactionID: &txID,
			AcquiredAt:    lot.AcquiredAt, SoldAt: now.AddDate(0, 0, -5),
			Quantity: decimal.NewFromInt(20), CostBasisPerUnit: lot.CostBasisPerUnit, SellPricePerUnit: decimal.NewFromFloat(20),
			CostBasis: 20000, Proceeds: 40000, RealizedGainLoss: 20000,
			Method: model.TaxLotMethodFIFO, HoldingPeriodDays: 795, IsLongTerm: false,
		},
		{
			// Loss rows must net against gains within each bucket
			LotID: lot.ID, PositionID: position.ID, PortfolioID: portfolio.ID, AssetID: position.AssetID,
			TransactionID: &txID,
			AcquiredAt:    lot.AcquiredAt, SoldAt: now.AddDate(0, 0, -2),
			Quantity: decimal.NewFromInt(10), CostBasisPerUnit: lot.CostBasisPerUnit, SellPricePerUnit: decimal.NewFromFloat(5),
			CostBasis: 10000, Proceeds: 5000, RealizedGainLoss: -5000,
			Method: model.TaxLotMethodFIFO, HoldingPeriodDays: 798, IsLongTerm: false,
		},
	}
	require.NoError(t, NewUnitOfWork(db.DB).TaxLotDisposition().CreateBatch(ctx, dispositions))

	gains, err := repo.CalculateRealizedGainsForUser(ctx, portfolio.UserID, now.AddDate(-1, 0, 0), now.AddDate(0, 0, 1))
	require.NoError(t, err)
	require.Equal(t, int64(55000), int64(gains.TotalRealized), "40k long + 20k short - 5k loss")
	require.Equal(t, int64(40000), int64(gains.LongTermGains))
	require.Equal(t, int64(15000), int64(gains.ShortTermGains), "20k gain - 5k loss nets inside the short-term bucket")
	require.Equal(t, 1, gains.TransactionCount, "3 disposition rows share one sell transaction; count reports distinct transactions")
}

// No dispositions → zero fiscal G/L, not proceeds misread as gains.
func TestTransactionRepository_CalculateRealizedGainsForUser_EmptyIsZero(t *testing.T) {
	db, portfolio, _ := setupDispositionWorld(t)
	ctx := context.Background()
	repo := NewUnitOfWork(db.DB).Transaction()

	now := time.Now().UTC()
	gains, err := repo.CalculateRealizedGainsForUser(ctx, portfolio.UserID, now.AddDate(-1, 0, 0), now.AddDate(0, 0, 1))
	require.NoError(t, err)
	require.Equal(t, int64(0), int64(gains.TotalRealized))
	require.Equal(t, int64(0), int64(gains.ShortTermGains))
	require.Equal(t, int64(0), int64(gains.LongTermGains))
}
