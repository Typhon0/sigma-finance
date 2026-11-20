package service

import (
	"context"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// accountTestUOW implements a lightweight in-memory stub of repository.IUnitOfWork for AccountService tests
type accountTestUOW struct {
	repository.IUnitOfWork
	users       map[string]*model.User
	portfolios  map[string]*model.Portfolio
	accounts    map[string]*model.Account
	connections map[string]*model.SyncConnection
	credentials map[string]*model.SyncCredential
	positions   map[string]*model.Position
}

type accountTestPositionRepo struct {
	repository.IPositionRepository
	uow *accountTestUOW
}

func (r *accountTestPositionRepo) UpdateOwnershipByAccount(ctx context.Context, accountID string, ownership decimal.Decimal) error {
	for _, p := range r.uow.positions {
		if p.AccountID == accountID {
			p.OwnershipPercentage = ownership
		}
	}
	return nil
}

func (r *accountTestPositionRepo) GetPositionsByAccount(ctx context.Context, accountID string) ([]model.Position, error) {
	var res []model.Position
	for _, p := range r.uow.positions {
		if p.AccountID == accountID {
			res = append(res, *p)
		}
	}
	return res, nil
}

type accountTestSyncRepo struct {
	repository.ISyncRepository
	uow *accountTestUOW
}

func (r *accountTestSyncRepo) GetConnectionByAccountID(ctx context.Context, accountID string) (*model.SyncConnection, error) {
	for _, c := range r.uow.connections {
		if c.AccountID != nil && *c.AccountID == accountID {
			return c, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *accountTestSyncRepo) DeleteConnection(ctx context.Context, id string) error {
	delete(r.uow.connections, id)
	return nil
}

func (r *accountTestSyncRepo) ListConnectionsByPortfolio(ctx context.Context, portfolioID string) ([]*model.SyncConnection, error) {
	var res []*model.SyncConnection
	for _, c := range r.uow.connections {
		if c.PortfolioID == portfolioID {
			res = append(res, c)
		}
	}
	return res, nil
}

func (r *accountTestSyncRepo) GetCredentialByProvider(ctx context.Context, userID, provider string) (*model.SyncCredential, error) {
	for _, c := range r.uow.credentials {
		if c.UserID == userID && c.Provider == provider {
			return c, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *accountTestSyncRepo) DeleteCredential(ctx context.Context, id string) error {
	delete(r.uow.credentials, id)
	return nil
}

type accountTestPortfolioRepo struct {
	repository.IPortfolioRepository
	uow *accountTestUOW
}

func (r *accountTestPortfolioRepo) GetByID(ctx context.Context, id string) (*model.Portfolio, error) {
	if p, ok := r.uow.portfolios[id]; ok {
		return p, nil
	}
	return nil, repository.ErrNotFound
}

type accountTestAccountRepo struct {
	repository.IAccountRepository
	uow *accountTestUOW
}

func (r *accountTestAccountRepo) Create(ctx context.Context, entity *model.Account) (*model.Account, error) {
	if entity.ID == "" {
		entity.ID = "acc-" + entity.Name
	}
	r.uow.accounts[entity.ID] = entity
	return entity, nil
}

func (r *accountTestAccountRepo) GetByID(ctx context.Context, id string) (*model.Account, error) {
	if a, ok := r.uow.accounts[id]; ok {
		return a, nil
	}
	return nil, repository.ErrNotFound
}

func (r *accountTestAccountRepo) GetAccountsByPortfolioID(ctx context.Context, portfolioID string) ([]model.Account, error) {
	var res []model.Account
	for _, a := range r.uow.accounts {
		if a.PortfolioID == portfolioID {
			res = append(res, *a)
		}
	}
	return res, nil
}

func (r *accountTestAccountRepo) GetAccountsByUserID(ctx context.Context, userID string) ([]model.Account, error) {
	var res []model.Account
	for _, a := range r.uow.accounts {
		if a.UserID == userID {
			res = append(res, *a)
		}
	}
	return res, nil
}

func (r *accountTestAccountRepo) GetAccountByName(ctx context.Context, portfolioID, name string) (*model.Account, error) {
	for _, a := range r.uow.accounts {
		if a.PortfolioID == portfolioID && a.Name == name {
			return a, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *accountTestAccountRepo) Update(ctx context.Context, entity *model.Account) error {
	if _, ok := r.uow.accounts[entity.ID]; !ok {
		return repository.ErrNotFound
	}
	r.uow.accounts[entity.ID] = entity
	return nil
}

func (r *accountTestAccountRepo) Delete(ctx context.Context, id string) error {
	if _, ok := r.uow.accounts[id]; !ok {
		return repository.ErrNotFound
	}
	delete(r.uow.accounts, id)
	return nil
}

func (u *accountTestUOW) Portfolio() repository.IPortfolioRepository {
	return &accountTestPortfolioRepo{uow: u}
}

func (u *accountTestUOW) Account() repository.IAccountRepository {
	return &accountTestAccountRepo{uow: u}
}

func (u *accountTestUOW) Position() repository.IPositionRepository {
	return &accountTestPositionRepo{uow: u}
}

func (u *accountTestUOW) Sync() repository.ISyncRepository {
	return &accountTestSyncRepo{uow: u}
}

// accountTestUserRepo keeps the ownership lookups CreateAccount/DeleteAccount
// perform from hitting the nil embedded interface.
type accountTestUserRepo struct {
	repository.IUserRepository
	uow *accountTestUOW
}

func (r *accountTestUserRepo) GetByID(ctx context.Context, id string) (*model.User, error) {
	if u, ok := r.uow.users[id]; ok {
		return u, nil
	}
	return nil, repository.ErrNotFound
}

func (u *accountTestUOW) User() repository.IUserRepository {
	return &accountTestUserRepo{uow: u}
}

func (u *accountTestUOW) Do(ctx context.Context, fn func(uow repository.IUnitOfWork) error) error {
	return fn(u)
}

func setupAccountTestService() (*AccountService, *accountTestUOW) {
	uow := &accountTestUOW{
		users:       make(map[string]*model.User),
		portfolios:  make(map[string]*model.Portfolio),
		accounts:    make(map[string]*model.Account),
		connections: make(map[string]*model.SyncConnection),
		credentials: make(map[string]*model.SyncCredential),
		positions:   make(map[string]*model.Position),
	}

	uow.users["user-1"] = &model.User{ID: "user-1", Email: "user1@example.com"}

	uow.portfolios["pf-1"] = &model.Portfolio{
		ID:         "pf-1",
		UserID:     "user-1",
		Name:       "Patrimoine Global",
		TaxWrapper: model.TaxWrapperStandardTaxable,
	}

	uow.portfolios["pf-pea"] = &model.Portfolio{
		ID:         "pf-pea",
		UserID:     "user-1",
		Name:       "Enveloppe PEA",
		TaxWrapper: model.TaxWrapperPEA,
	}

	return NewAccountService(uow), uow
}

func TestAccountService_CreateAccount(t *testing.T) {
	svc, _ := setupAccountTestService()
	ctx := context.Background()

	t.Run("success creating Trade Republic CTO", func(t *testing.T) {
		acc, err := svc.CreateAccount(ctx, "user-1", CreateAccountInput{
			PortfolioID: "pf-1",
			Name:        "Trade Republic CTO",
			Type:        model.AccountTypeBroker,
			TaxWrapper:  model.TaxWrapperStandardTaxable,
		})
		require.NoError(t, err)
		assert.Equal(t, "Trade Republic CTO", acc.Name)
		assert.Equal(t, model.TaxWrapperStandardTaxable, acc.TaxWrapper)
		assert.Equal(t, model.AccountTypeBroker, acc.Type)
	})

	t.Run("inherits portfolio tax wrapper when unspecified", func(t *testing.T) {
		acc, err := svc.CreateAccount(ctx, "user-1", CreateAccountInput{
			PortfolioID: "pf-pea",
			Name:        "Fortuneo PEA",
			Type:        model.AccountTypeBroker,
		})
		require.NoError(t, err)
		assert.Equal(t, model.TaxWrapperPEA, acc.TaxWrapper)
	})

	t.Run("fails on unauthorized portfolio", func(t *testing.T) {
		_, err := svc.CreateAccount(ctx, "user-intruder", CreateAccountInput{
			PortfolioID: "pf-1",
			Name:        "Malicious Account",
		})
		assert.ErrorIs(t, err, ErrPortfolioUnauthorized)
	})

	t.Run("fails on duplicate account name in same portfolio", func(t *testing.T) {
		_, err := svc.CreateAccount(ctx, "user-1", CreateAccountInput{
			PortfolioID: "pf-1",
			Name:        "Trade Republic CTO",
		})
		assert.ErrorIs(t, err, ErrAccountNameExists)
	})
}

func TestAccountService_GetAndUpdateAccount(t *testing.T) {
	svc, uow := setupAccountTestService()
	ctx := context.Background()

	created, err := svc.CreateAccount(ctx, "user-1", CreateAccountInput{
		PortfolioID: "pf-1",
		Name:        "Binance Spot",
		Type:        model.AccountTypeCryptoExchange,
		TaxWrapper:  model.TaxWrapperCryptoVault,
	})
	require.NoError(t, err)

	t.Run("get account success", func(t *testing.T) {
		acc, err := svc.GetAccount(ctx, "user-1", created.ID)
		require.NoError(t, err)
		assert.Equal(t, "Binance Spot", acc.Name)
	})

	t.Run("get account unauthorized", func(t *testing.T) {
		_, err := svc.GetAccount(ctx, "user-other", created.ID)
		assert.ErrorIs(t, err, ErrAccountUnauthorized)
	})

	t.Run("update account name", func(t *testing.T) {
		newName := "Binance Main"
		updated, err := svc.UpdateAccount(ctx, "user-1", created.ID, UpdateAccountInput{
			Name: &newName,
		})
		require.NoError(t, err)
		assert.Equal(t, "Binance Main", updated.Name)
	})

	t.Run("delete account", func(t *testing.T) {
		err := svc.DeleteAccount(ctx, "user-1", created.ID)
		require.NoError(t, err)

		_, err = svc.GetAccount(ctx, "user-1", created.ID)
		assert.ErrorIs(t, err, ErrAccountNotFound)
	})

	t.Run("delete account cleans up sync connection and credential", func(t *testing.T) {
		krakenProvider := model.SyncProviderKraken
		syncAcc, err := svc.CreateAccount(ctx, "user-1", CreateAccountInput{
			PortfolioID:  "pf-1",
			Name:         "Kraken Trading Account",
			Type:         model.AccountTypeCryptoExchange,
			TaxWrapper:   model.TaxWrapperCryptoVault,
			SyncProvider: &krakenProvider,
		})
		require.NoError(t, err)

		cred := &model.SyncCredential{
			ID:       "cred-kraken-1",
			UserID:   "user-1",
			Provider: model.SyncProviderKraken,
		}
		uow.credentials[cred.ID] = cred

		conn := &model.SyncConnection{
			ID:           "conn-kraken-1",
			UserID:       "user-1",
			PortfolioID:  "pf-1",
			CredentialID: cred.ID,
			AccountID:    &syncAcc.ID,
			Provider:     model.SyncProviderKraken,
		}
		uow.connections[conn.ID] = conn

		// Delete account
		err = svc.DeleteAccount(ctx, "user-1", syncAcc.ID)
		require.NoError(t, err)

		// Account should be deleted
		_, err = svc.GetAccount(ctx, "user-1", syncAcc.ID)
		assert.ErrorIs(t, err, ErrAccountNotFound)

		// Connection and orphaned credential should be deleted
		assert.NotContains(t, uow.connections, conn.ID)
		assert.NotContains(t, uow.credentials, cred.ID)
	})

	t.Run("ownership percentage creation and cascading update to positions", func(t *testing.T) {
		pct50 := decimal.NewFromFloat(50.0)
		coName := "Emma"
		jointAcc, err := svc.CreateAccount(ctx, "user-1", CreateAccountInput{
			PortfolioID:         "pf-1",
			Name:                "Compte Joint Bourso",
			Type:                model.AccountTypeBank,
			OwnershipPercentage: &pct50,
			CoOwnerName:         &coName,
		})
		require.NoError(t, err)
		assert.True(t, jointAcc.OwnershipPercentage.Equal(decimal.NewFromFloat(50.0)))
		assert.NotNil(t, jointAcc.CoOwnerName)
		assert.Equal(t, "Emma", *jointAcc.CoOwnerName)

		// Create a position under this account
		pos := &model.Position{
			ID:                  "pos-1",
			PortfolioID:         "pf-1",
			AccountID:           jointAcc.ID,
			AssetID:             "asset-cash",
			OwnershipPercentage: decimal.NewFromFloat(50.0),
		}
		uow.positions[pos.ID] = pos

		// Update account ownership to 70% and update co-owner name
		pct70 := decimal.NewFromFloat(70.0)
		newCoName := "Emma Jussiant"
		updated, err := svc.UpdateAccount(ctx, "user-1", jointAcc.ID, UpdateAccountInput{
			OwnershipPercentage: &pct70,
			CoOwnerName:         &newCoName,
		})
		require.NoError(t, err)
		assert.True(t, updated.OwnershipPercentage.Equal(decimal.NewFromFloat(70.0)))
		assert.NotNil(t, updated.CoOwnerName)
		assert.Equal(t, "Emma Jussiant", *updated.CoOwnerName)

		// Check that the position's ownership was cascaded
		assert.True(t, uow.positions[pos.ID].OwnershipPercentage.Equal(decimal.NewFromFloat(70.0)))

		// When ownership is reset to 100%, co-owner fields are cleared
		pct100 := decimal.NewFromFloat(100.0)
		resetAcc, err := svc.UpdateAccount(ctx, "user-1", jointAcc.ID, UpdateAccountInput{
			OwnershipPercentage: &pct100,
		})
		require.NoError(t, err)
		assert.True(t, resetAcc.OwnershipPercentage.Equal(decimal.NewFromFloat(100.0)))
		assert.Nil(t, resetAcc.CoOwnerName)
		assert.Nil(t, resetAcc.CoOwnerUserID)
	})
}
