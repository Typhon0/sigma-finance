package service

import (
	"context"
	"errors"
	"fmt"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"strings"
	"time"
)

var (
	// ErrAccountNotFound indicates that the requested account does not exist
	ErrAccountNotFound = errors.New("account not found")

	// ErrAccountUnauthorized indicates that the user is not authorized to access the account
	ErrAccountUnauthorized = errors.New("unauthorized to access this account")

	// ErrAccountNameExists indicates an account with the same name already exists in the portfolio
	ErrAccountNameExists = errors.New("account with this name already exists in the portfolio")
)

// CreateAccountInput holds the input parameters for creating a new Account
type CreateAccountInput struct {
	PortfolioID   string
	Name          string
	Type          model.AccountType
	TaxWrapper    model.TaxWrapperType
	Institution   *string
	AccountNumber *string
	Currency      *string
	SyncProvider  *string
}

// UpdateAccountInput holds the input parameters for updating an existing Account
type UpdateAccountInput struct {
	Name          *string
	Type          *model.AccountType
	TaxWrapper    *model.TaxWrapperType
	Institution   *string
	AccountNumber *string
	Currency      *string
}

// IAccountService defines business operations on custodial/legal Accounts
type IAccountService interface {
	CreateAccount(ctx context.Context, userID string, input CreateAccountInput) (*model.Account, error)
	GetAccount(ctx context.Context, userID, accountID string) (*model.Account, error)
	ListPortfolioAccounts(ctx context.Context, userID, portfolioID string) ([]model.Account, error)
	ListUserAccounts(ctx context.Context, userID string) ([]model.Account, error)
	UpdateAccount(ctx context.Context, userID, accountID string, input UpdateAccountInput) (*model.Account, error)
	DeleteAccount(ctx context.Context, userID, accountID string) error
}

// AccountService implements IAccountService
type AccountService struct {
	uow repository.IUnitOfWork
}

// NewAccountService creates a new instance of AccountService
func NewAccountService(uow repository.IUnitOfWork) *AccountService {
	return &AccountService{uow: uow}
}

// CreateAccount creates a new account in a portfolio, validating ownership and uniqueness
func (s *AccountService) CreateAccount(ctx context.Context, userID string, input CreateAccountInput) (*model.Account, error) {
	if strings.TrimSpace(input.Name) == "" {
		return nil, errors.New("account name is required")
	}
	if input.PortfolioID == "" {
		return nil, errors.New("portfolio ID is required")
	}

	// 1. Verify that the portfolio belongs to this user
	pf, err := s.uow.Portfolio().GetByID(ctx, input.PortfolioID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrPortfolioNotFound
		}
		return nil, fmt.Errorf("failed to retrieve portfolio: %w", err)
	}
	if pf.UserID != userID {
		return nil, ErrPortfolioUnauthorized
	}

	// 2. Check for duplicate account name in the same portfolio
	existing, err := s.uow.Account().GetAccountByName(ctx, input.PortfolioID, input.Name)
	if err == nil && existing != nil {
		return nil, ErrAccountNameExists
	}

	// 3. Defaults
	accountType := input.Type
	if !accountType.IsValid() {
		accountType = model.AccountTypeBroker
	}

	taxWrapper := input.TaxWrapper
	if taxWrapper == "" {
		// Inherit portfolio's tax wrapper as default template
		if pf.TaxWrapper != "" {
			taxWrapper = pf.TaxWrapper
		} else {
			taxWrapper = model.TaxWrapperStandardTaxable
		}
	}

	currency := model.CurrencyEUR
	if input.Currency != nil && strings.TrimSpace(*input.Currency) != "" {
		currency = model.Currency(strings.ToUpper(strings.TrimSpace(*input.Currency)))
	}

	syncProvider := "MANUAL"
	if input.SyncProvider != nil && strings.TrimSpace(*input.SyncProvider) != "" {
		syncProvider = strings.ToUpper(strings.TrimSpace(*input.SyncProvider))
	}

	now := time.Now()
	account := &model.Account{
		UserID:        userID,
		PortfolioID:   input.PortfolioID,
		Name:          strings.TrimSpace(input.Name),
		Type:          accountType,
		TaxWrapper:    taxWrapper,
		Institution:   input.Institution,
		AccountNumber: input.AccountNumber,
		Currency:      currency,
		SyncProvider:  syncProvider,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := account.Validate(); err != nil {
		return nil, err
	}

	created, err := s.uow.Account().Create(ctx, account)
	if err != nil {
		return nil, fmt.Errorf("failed to create account: %w", err)
	}

	return created, nil
}

// GetAccount retrieves an account by ID, verifying user ownership
func (s *AccountService) GetAccount(ctx context.Context, userID, accountID string) (*model.Account, error) {
	acc, err := s.uow.Account().GetByID(ctx, accountID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrAccountNotFound
		}
		return nil, err
	}
	if acc.UserID != userID {
		return nil, ErrAccountUnauthorized
	}
	return acc, nil
}

// ListPortfolioAccounts lists all accounts in a portfolio
func (s *AccountService) ListPortfolioAccounts(ctx context.Context, userID, portfolioID string) ([]model.Account, error) {
	pf, err := s.uow.Portfolio().GetByID(ctx, portfolioID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrPortfolioNotFound
		}
		return nil, err
	}
	if pf.UserID != userID {
		return nil, ErrPortfolioUnauthorized
	}

	return s.uow.Account().GetAccountsByPortfolioID(ctx, portfolioID)
}

// ListUserAccounts lists all accounts owned by a user across all portfolios
func (s *AccountService) ListUserAccounts(ctx context.Context, userID string) ([]model.Account, error) {
	return s.uow.Account().GetAccountsByUserID(ctx, userID)
}

// UpdateAccount updates account attributes with ownership verification
func (s *AccountService) UpdateAccount(ctx context.Context, userID, accountID string, input UpdateAccountInput) (*model.Account, error) {
	acc, err := s.GetAccount(ctx, userID, accountID)
	if err != nil {
		return nil, err
	}

	if input.Name != nil {
		trimmed := strings.TrimSpace(*input.Name)
		if trimmed == "" {
			return nil, errors.New("account name cannot be empty")
		}
		acc.Name = trimmed
	}

	if input.Type != nil && input.Type.IsValid() {
		acc.Type = *input.Type
	}

	if input.TaxWrapper != nil && *input.TaxWrapper != "" {
		acc.TaxWrapper = *input.TaxWrapper
	}

	if input.Institution != nil {
		acc.Institution = input.Institution
	}

	if input.AccountNumber != nil {
		acc.AccountNumber = input.AccountNumber
	}

	if input.Currency != nil && strings.TrimSpace(*input.Currency) != "" {
		acc.Currency = model.Currency(strings.ToUpper(strings.TrimSpace(*input.Currency)))
	}

	acc.UpdatedAt = time.Now()

	if err := acc.Validate(); err != nil {
		return nil, err
	}

	if err := s.uow.Account().Update(ctx, acc); err != nil {
		return nil, fmt.Errorf("failed to update account: %w", err)
	}

	return acc, nil
}

// DeleteAccount removes an account if it belongs to the user
func (s *AccountService) DeleteAccount(ctx context.Context, userID, accountID string) error {
	acc, err := s.GetAccount(ctx, userID, accountID)
	if err != nil {
		return err
	}

	return s.uow.Account().Delete(ctx, acc.ID)
}
