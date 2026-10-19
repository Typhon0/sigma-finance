package service

import (
	"context"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// accountTestUOW implements a lightweight in-memory stub of repository.IUnitOfWork for AccountService tests
type accountTestUOW struct {
	repository.IUnitOfWork
	portfolios map[string]*model.Portfolio
	accounts   map[string]*model.Account
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

func setupAccountTestService() (*AccountService, *accountTestUOW) {
	uow := &accountTestUOW{
		portfolios: make(map[string]*model.Portfolio),
		accounts:   make(map[string]*model.Account),
	}

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
	svc, _ := setupAccountTestService()
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
}
