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

	// State the jurisdiction instead of relying on the column default: France
	// defaults to the PMP method, which would silently replace the FIFO
	// matching this test is about with average cost.
	user, err := uow.User().Create(ctx, &model.User{
		ID:              uuid.NewString(),
		Email:           "sell_" + uuid.NewString()[:8] + "@example.com",
		Name:            "Sell Test User",
		EmailVerified:   true,
		TaxJurisdiction: "US",
	})
	require.NoError(t, err)

	portfolio, err := uow.Portfolio().Create(ctx, &model.Portfolio{
		ID:     uuid.NewString(),
		UserID: user.ID,
		Name:   "Sell Portfolio",
	})
	require.NoError(t, err)

	account, err := uow.Account().Create(ctx, &model.Account{
		ID:          uuid.NewString(),
		UserID:      user.ID,
		PortfolioID: portfolio.ID,
		Name:        "Sell Account",
		Type:        model.AccountTypeBroker,
		Currency:    "USD",
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
		AccountID:        account.ID,
		PortfolioID:      portfolio.ID,
		AssetID:          asset.ID,
		Quantity:         decimal.NewFromInt(100),
		AverageCostBasis: &avg,
		QuoteCurrency:    "USD",
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

// ConsumeTaxLotsForSale is the single place a sale consumes lots (the sync
// path and any future manual entry both go through it). Selling must persist
// one fiscal disposition per matched lot, with real FIFO matching.
func TestConsumeTaxLotsForSale_PersistsFiscalDispositions(t *testing.T) {
	ctx, uow, portfolio, position := setupSellWorld(t)

	result, err := ConsumeTaxLotsForSale(
		ctx, uow, position,
		decimal.NewFromInt(60), decimal.NewFromFloat(30),
		time.Now().UTC(), "", portfolio.UserID,
	)
	require.NoError(t, err)
	require.NotNil(t, result)

	// FISCAL: FIFO consumes the 50 cheap units ($10) then 10 of the $20 units.
	// gain = 50*(30-10) + 10*(30-20) = 1000 + 100 dollars = 110000 cents.
	require.Equal(t, int64(110000), int64(result.TotalRealizedGainLoss))
	require.Len(t, result.Matches, 2)
	require.Equal(t, int64(100000), int64(result.LongTermGainLoss))
	require.Equal(t, int64(10000), int64(result.ShortTermGainLoss))

	// Fiscal rows persisted per matched lot.
	dispositions, err := uow.TaxLotDisposition().FindByPositionID(ctx, position.ID)
	require.NoError(t, err)
	require.Len(t, dispositions, 2)
	sum := int64(0)
	for _, d := range dispositions {
		sum += int64(d.RealizedGainLoss)
	}
	require.Equal(t, int64(110000), sum, "persisted dispositions must equal the fiscal total")

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

// Lot-allocation failure must fail the sale before anything is persisted:
// dispositions feed tax records, so selling without fiscal G/L is not allowed.
func TestConsumeTaxLotsForSale_InsufficientLotsFails(t *testing.T) {
	ctx, uow, portfolio, position := setupSellWorld(t)

	// Position holds 100 units but only ONE lot (50) stays open. Selling 60
	// passes a position-quantity check yet cannot be lot-matched, so
	// allocation must fail.
	lots, err := uow.TaxLot().FindByPositionID(ctx, position.ID)
	require.NoError(t, err)
	require.Len(t, lots, 2)
	closed := false
	for _, l := range lots {
		if l.CostBasisPerUnit.Equal(decimal.NewFromFloat(20)) {
			l.RemainingQuantity = decimal.Zero
			l.Status = model.TaxLotStatusClosed
			require.NoError(t, uow.TaxLot().Update(ctx, l))
			closed = true
		}
	}
	require.True(t, closed, "the $20 lot must be the one closed")

	_, err = ConsumeTaxLotsForSale(
		ctx, uow, position,
		decimal.NewFromInt(60), decimal.NewFromFloat(30),
		time.Now().UTC(), "", portfolio.UserID,
	)
	require.Error(t, err, "selling with no allocatable lots must fail, not silently skip fiscal G/L")
	require.Contains(t, err.Error(), "insufficient quantity")

	// Nothing persisted: no dispositions, and the open lot was not written.
	dispositions, err := uow.TaxLotDisposition().FindByPositionID(ctx, position.ID)
	require.NoError(t, err)
	require.Empty(t, dispositions, "failed allocation must not persist dispositions")

	unchanged, err := uow.TaxLot().FindByPositionID(ctx, position.ID)
	require.NoError(t, err)
	for _, l := range unchanged {
		if l.CostBasisPerUnit.Equal(decimal.NewFromFloat(10)) {
			require.True(t, l.RemainingQuantity.Equal(decimal.NewFromInt(50)),
				"lots must not be written when allocation fails, got %s", l.RemainingQuantity)
		}
	}
}
