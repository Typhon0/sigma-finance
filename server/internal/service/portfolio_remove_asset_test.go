package service

import (
	"context"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type removeAssetTestUOW struct {
	repository.IUnitOfWork
	portfolios      map[string]*model.Portfolio
	accounts        map[string]*model.Account
	assets          map[string]*model.Asset
	positions       map[string]*model.Position
	portfolioAssets map[string]*model.PortfolioAsset
}

func (u *removeAssetTestUOW) Do(ctx context.Context, fn func(repository.IUnitOfWork) error) error {
	return fn(u)
}

func (u *removeAssetTestUOW) Portfolio() repository.IPortfolioRepository {
	return &removeAssetTestPortfolioRepo{u: u}
}

func (u *removeAssetTestUOW) Account() repository.IAccountRepository {
	return &removeAssetTestAccountRepo{u: u}
}

func (u *removeAssetTestUOW) Asset() repository.IAssetRepository {
	return &removeAssetTestAssetRepo{u: u}
}

func (u *removeAssetTestUOW) Position() repository.IPositionRepository {
	return &removeAssetTestPositionRepo{u: u}
}

func (u *removeAssetTestUOW) PortfolioAsset() repository.IPortfolioAssetRepository {
	return &removeAssetTestPortfolioAssetRepo{u: u}
}

func (u *removeAssetTestUOW) Performance() repository.IPerformanceRepository {
	return &removeAssetTestPerformanceRepo{}
}

func (u *removeAssetTestUOW) Transaction() repository.ITransactionRepository {
	return &removeAssetTestTransactionRepo{}
}

type removeAssetTestTransactionRepo struct {
	repository.ITransactionRepository
}

func (r *removeAssetTestTransactionRepo) FindWithFilters(ctx context.Context, filter repository.TransactionFilter) ([]model.Transaction, error) {
	return nil, nil
}

func (r *removeAssetTestTransactionRepo) FindByPortfolioID(ctx context.Context, portfolioID string) ([]model.Transaction, error) {
	return nil, nil
}

type removeAssetTestPerformanceRepo struct {
	repository.IPerformanceRepository
}

func (r *removeAssetTestPerformanceRepo) CalculateAndSaveHistoricalSnapshots(ctx context.Context, portfolioID string, startDate, endDate time.Time) error {
	return nil
}

type removeAssetTestPortfolioRepo struct {
	repository.IPortfolioRepository
	u *removeAssetTestUOW
}

func (r *removeAssetTestPortfolioRepo) GetByID(ctx context.Context, id string) (*model.Portfolio, error) {
	if p, ok := r.u.portfolios[id]; ok {
		return p, nil
	}
	return nil, repository.ErrNotFound
}

type removeAssetTestAccountRepo struct {
	repository.IAccountRepository
	u *removeAssetTestUOW
}

func (r *removeAssetTestAccountRepo) GetByID(ctx context.Context, id string) (*model.Account, error) {
	if a, ok := r.u.accounts[id]; ok {
		return a, nil
	}
	return nil, repository.ErrNotFound
}

type removeAssetTestAssetRepo struct {
	repository.IAssetRepository
	u *removeAssetTestUOW
}

func (r *removeAssetTestAssetRepo) GetByID(ctx context.Context, id string) (*model.Asset, error) {
	if a, ok := r.u.assets[id]; ok {
		return a, nil
	}
	return nil, repository.ErrNotFound
}

type removeAssetTestPositionRepo struct {
	repository.IPositionRepository
	u *removeAssetTestUOW
}

func (r *removeAssetTestPositionRepo) GetByAccountAndAsset(ctx context.Context, accountID, assetID string) (*model.Position, error) {
	for _, p := range r.u.positions {
		if p.AccountID == accountID && p.AssetID == assetID {
			return p, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *removeAssetTestPositionRepo) Delete(ctx context.Context, id string) error {
	delete(r.u.positions, id)
	return nil
}

func (r *removeAssetTestPositionRepo) FindAllBy(ctx context.Context, options ...repository.QueryOption) ([]model.Position, error) {
	// For testing, return matching positions for portfolioID and assetID
	var res []model.Position
	dummyQuery := r.u.positions
	for _, p := range dummyQuery {
		res = append(res, *p)
	}
	return res, nil
}

type removeAssetTestPortfolioAssetRepo struct {
	repository.IPortfolioAssetRepository
	u *removeAssetTestUOW
}

func (r *removeAssetTestPortfolioAssetRepo) FindByPortfolioAndAsset(ctx context.Context, portfolioID, assetID string) (*model.PortfolioAsset, error) {
	key := portfolioID + ":" + assetID
	if pa, ok := r.u.portfolioAssets[key]; ok {
		return pa, nil
	}
	return nil, repository.ErrNotFound
}

func (r *removeAssetTestPortfolioAssetRepo) UpdatePortfolioAsset(ctx context.Context, pa *model.PortfolioAsset) error {
	key := pa.PortfolioID + ":" + pa.AssetID
	r.u.portfolioAssets[key] = pa
	return nil
}

func (r *removeAssetTestPortfolioAssetRepo) DeleteByPortfolioAndAsset(ctx context.Context, portfolioID, assetID string) error {
	key := portfolioID + ":" + assetID
	delete(r.u.portfolioAssets, key)
	return nil
}

func TestRemoveAssetFromPortfolio_MultiAccount(t *testing.T) {
	ctx := context.Background()
	portfolioID := "port-1"
	assetID := "asset-googl"
	accManualID := "acc-manual"
	accSyncedID := "acc-synced"

	costBasisManual := decimal.NewFromFloat(160.0)
	costBasisSynced := decimal.NewFromFloat(140.0)

	setupUOW := func() (*removeAssetTestUOW, *PortfolioService) {
		uow := &removeAssetTestUOW{
			portfolios: map[string]*model.Portfolio{
				portfolioID: {ID: portfolioID, Name: "Main Portfolio"},
			},
			accounts: map[string]*model.Account{
				accManualID: {ID: accManualID, PortfolioID: portfolioID, Name: "Compte Principal", SyncProvider: "MANUAL"},
				accSyncedID: {ID: accSyncedID, PortfolioID: portfolioID, Name: "Trade Republic CTO", SyncProvider: "TRADEREPUBLIC"},
			},
			assets: map[string]*model.Asset{
				assetID: {ID: assetID, Name: "Alphabet Inc."},
			},
			positions: map[string]*model.Position{
				"pos-1": {
					ID:               "pos-1",
					PortfolioID:      portfolioID,
					AccountID:        accManualID,
					AssetID:          assetID,
					Quantity:         decimal.NewFromInt(6),
					AverageCostBasis: &costBasisManual,
				},
				"pos-2": {
					ID:               "pos-2",
					PortfolioID:      portfolioID,
					AccountID:        accSyncedID,
					AssetID:          assetID,
					Quantity:         decimal.NewFromInt(13),
					AverageCostBasis: &costBasisSynced,
				},
			},
			portfolioAssets: map[string]*model.PortfolioAsset{
				portfolioID + ":" + assetID: {
					PortfolioID:          portfolioID,
					AssetID:              assetID,
					Quantity:             19.0,
					AveragePurchasePrice: 146.31,
				},
			},
		}

		svc := &PortfolioService{
			uow:            uow,
			analyticsCache: make(map[string]analyticsCacheEntry),
		}
		return uow, svc
	}

	t.Run("Deleting position from manual account preserves synced account and updates portfolio_asset", func(t *testing.T) {
		uow, svc := setupUOW()

		err := svc.RemoveAssetFromPortfolio(ctx, portfolioID, assetID, &accManualID)
		require.NoError(t, err)

		// Assert: pos-1 (manual) was deleted
		_, exists := uow.positions["pos-1"]
		assert.False(t, exists, "manual position pos-1 must be deleted")

		// Assert: pos-2 (synced) was NOT deleted
		pos2, exists := uow.positions["pos-2"]
		assert.True(t, exists, "synced position pos-2 must be preserved")
		assert.Equal(t, 13.0, pos2.Quantity.InexactFloat64())

		// Assert: portfolio_asset was NOT deleted, but updated to 13
		pa, exists := uow.portfolioAssets[portfolioID+":"+assetID]
		assert.True(t, exists, "portfolio_asset must not be deleted while synced positions remain")
		assert.Equal(t, 13.0, pa.Quantity)
		assert.InDelta(t, 140.0, pa.AveragePurchasePrice, 0.01)
	})

	t.Run("Deleting position from synced account is blocked", func(t *testing.T) {
		_, svc := setupUOW()

		err := svc.RemoveAssetFromPortfolio(ctx, portfolioID, assetID, &accSyncedID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "cannot manually delete position from synchronized account")
	})

	t.Run("Deleting last remaining position deletes portfolio_asset", func(t *testing.T) {
		uow, svc := setupUOW()
		delete(uow.positions, "pos-2") // Remove synced position first

		err := svc.RemoveAssetFromPortfolio(ctx, portfolioID, assetID, &accManualID)
		require.NoError(t, err)

		_, exists := uow.positions["pos-1"]
		assert.False(t, exists)

		_, existsPA := uow.portfolioAssets[portfolioID+":"+assetID]
		assert.False(t, existsPA, "portfolio_asset must be deleted when no active positions remain")
	})
}
