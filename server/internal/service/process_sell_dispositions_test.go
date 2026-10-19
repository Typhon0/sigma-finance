package service

import (
	"context"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/testutil"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/require"
)

// setupSellWorld seeds user → portfolio → asset → position with average cost
// basis, plus two open tax lots (one long-held cheap, one recent expensive).
func setupSellWorld(t *testing.T) (context.Context, repository.IUnitOfWork, *model.Portfolio, *model.Position) {
	t.Helper()
	testDB := testutil.NewTestDB(t)
	t.Cleanup(testDB.Close)
	ctx := context.Background()
	testDB.CleanupTables(ctx)

	uow := repository.NewUnitOfWork(testDB.DB)

	user, err := uow.User().Create(ctx, &model.User{
		ID:            uuid.NewString(),
		Email:         "sell_" + uuid.NewString()[:8] + "@example.com",
		Name:          "Sell Test User",
		EmailVerified: true,
	})
	require.NoError(t, err)

	portfolio, err := uow.Portfolio().Create(ctx, &model.Portfolio{
		ID:     uuid.NewString(),
		UserID: user.ID,
		Name:   "Sell Portfolio",
	})
	require.NoError(t, err)

	asset, err := uow.Asset().Create(ctx, &model.Asset{
		ID:          uuid.NewString(),
		Type:        model.AssetTypeStock,
		Symbol:      &[]string{"SELL"}[0],
		Name:        "Sell Test Asset",
		IsTradeable: true,
	})
	require.NoError(t, err)

	avg := decimal.NewFromFloat(15)
	position, err := uow.Position().Create(ctx, &model.Position{
		ID:               uuid.NewString(),
		PortfolioID:      portfolio.ID,
		AssetID:          asset.ID,
		Quantity:         decimal.NewFromInt(100),
		AverageCostBasis: &avg,
	})
	require.NoError(t, err)

	lots := []*model.TaxLot{
		{
			PortfolioID: portfolio.ID, PositionID: position.ID, AssetID: asset.ID,
			AcquiredAt:        time.Now().UTC().AddDate(0, 0, -400),
			InitialQuantity:   decimal.NewFromInt(50),
			RemainingQuantity: decimal.NewFromInt(50),
			CostBasisPerUnit:  decimal.NewFromFloat(10),
			TotalCostBasis:    50000,
			Currency:          model.CurrencyUSD,
			Status:            model.TaxLotStatusOpen,
		},
		{
			PortfolioID: portfolio.ID, PositionID: position.ID, AssetID: asset.ID,
			AcquiredAt:        time.Now().UTC().AddDate(0, 0, -100),
			InitialQuantity:   decimal.NewFromInt(50),
			RemainingQuantity: decimal.NewFromInt(50),
			CostBasisPerUnit:  decimal.NewFromFloat(20),
			TotalCostBasis:    100000,
			Currency:          model.CurrencyUSD,
			Status:            model.TaxLotStatusOpen,
		},
	}
	for _, lot := range lots {
		if _, err := uow.TaxLot().Create(ctx, lot); err != nil {
			require.NoError(t, err)
		}
	}

	return ctx, uow, portfolio, position
}

// Selling must persist one fiscal disposition per matched lot, with real
// FIFO matching, while the economic P/L accumulates separately on the position.
func TestProcessSellTransaction_PersistsDispositionsAndSeparatesFiscalFromEconomic(t *testing.T) {
	ctx, uow, portfolio, position := setupSellWorld(t)
	svc := NewTransactionService(uow)

	result, err := svc.ProcessSellTransaction(ctx, SellTransactionRequest{
		UserID:            portfolio.UserID,
		PositionID:        position.ID,
		Quantity:          decimal.NewFromInt(60),
		UnitPriceAmount:   decimal.NewFromFloat(30),
		UnitPriceCurrency: model.CurrencyUSD,
		ExecutedAt:        time.Now().UTC(),
	})
	require.NoError(t, err)
	require.NotNil(t, result)

	// FISCAL: FIFO consumes the 50 cheap units ($10) then 10 of the $20 units.
	// gain = 50*(30-10) + 10*(30-20) = 1000 + 100 dollars = 110000 cents.
	require.NotNil(t, result.FiscalRealizedGainLoss, "fiscal lot-matched G/L must be reported")
	require.Equal(t, int64(110000), int64(*result.FiscalRealizedGainLoss))
	require.NotNil(t, result.FiscalAllocationDetails)
	require.Len(t, result.FiscalAllocationDetails.Matches, 2)
	require.Equal(t, int64(100000), int64(result.FiscalAllocationDetails.LongTermGainLoss))
	require.Equal(t, int64(10000), int64(result.FiscalAllocationDetails.ShortTermGainLoss))

	// ECONOMIC: average cost $15 → gain = 60*(30-15) = 900 dollars = 90000 cents.
	// Distinct from the fiscal number — the two must never be conflated.
	require.NotNil(t, result.RealizedGains)
	require.Equal(t, int64(90000), int64(*result.RealizedGains))
	require.NotEqual(t, *result.RealizedGains, *result.FiscalRealizedGainLoss,
		"economic and fiscal numbers differ here; if equal something collapsed them")

	// Fiscal rows persisted per matched lot.
	dispositions, err := uow.TaxLotDisposition().FindByPositionID(ctx, position.ID)
	require.NoError(t, err)
	require.Len(t, dispositions, 2)
	sum := int64(0)
	for _, d := range dispositions {
		sum += int64(d.RealizedGainLoss)
	}
	require.Equal(t, int64(110000), sum, "persisted dispositions must equal the fiscal total")

	// Economic P/L persisted on the position.
	updated, err := uow.Position().GetByID(ctx, position.ID)
	require.NoError(t, err)
	require.Equal(t, int64(90000), int64(updated.RealizedGainLoss))

	// Lots updated: first lot closed, second partially closed.
	// (decimal does not compare with == across scale, so match via Equal.)
	lots, err := uow.TaxLot().FindByPositionID(ctx, position.ID)
	require.NoError(t, err)
	require.Len(t, lots, 2)
	statusByCost := func(cost string) model.TaxLotStatus {
		for _, l := range lots {
			if l.CostBasisPerUnit.Equal(decimal.RequireFromString(cost)) {
				return l.Status
			}
		}
		return ""
	}
	require.Equal(t, model.TaxLotStatusClosed, statusByCost("10"))
	require.Equal(t, model.TaxLotStatusPartiallyClosed, statusByCost("20"))
}

// Lot-allocation failure must FATAL the sell (full rollback), because
// dispositions now feed tax records — silently selling without fiscal G/L
// is no longer acceptable.
func TestProcessSellTransaction_InsufficientLotsFailsAtomically(t *testing.T) {
	ctx, uow, portfolio, position := setupSellWorld(t)
	svc := NewTransactionService(uow)

	// Position holds 100 units but only ONE lot (50) stays open. Selling 60
	// passes the position-quantity check yet cannot be lot-matched, so
	// allocation must fail and roll the entire sell back.
	lots, err := uow.TaxLot().FindByPositionID(ctx, position.ID)
	require.NoError(t, err)
	require.Len(t, lots, 2)
	for i, l := range lots {
		if i > 0 {
			l.RemainingQuantity = decimal.Zero
			l.Status = model.TaxLotStatusClosed
			require.NoError(t, uow.TaxLot().Update(ctx, l))
		}
	}

	_, err = svc.ProcessSellTransaction(ctx, SellTransactionRequest{
		UserID:            portfolio.UserID,
		PositionID:        position.ID,
		Quantity:          decimal.NewFromInt(60),
		UnitPriceAmount:   decimal.NewFromFloat(30),
		UnitPriceCurrency: model.CurrencyUSD,
		ExecutedAt:        time.Now().UTC(),
	})
	require.Error(t, err, "selling with no allocatable lots must fail, not silently skip fiscal G/L")
	require.Contains(t, err.Error(), "insufficient quantity")

	// Atomicity: nothing persisted — no transaction, no position change.
	txs, err := uow.Transaction().FindByPositionID(ctx, position.ID)
	require.NoError(t, err)
	require.Empty(t, txs, "failed sell must roll back the transaction record")

	updated, err := uow.Position().GetByID(ctx, position.ID)
	require.NoError(t, err)
	require.True(t, updated.Quantity.Equal(decimal.NewFromInt(100)), "position quantity must be unchanged after rollback, got %s", updated.Quantity)
	require.Equal(t, int64(0), int64(updated.RealizedGainLoss), "economic P/L must be unchanged after rollback")
}
