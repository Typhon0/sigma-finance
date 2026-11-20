package service

import (
	"context"
	"errors"
	"fmt"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"strings"
	"time"

	"github.com/shopspring/decimal"
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
	PortfolioID         string
	Name                string
	Type                model.AccountType
	TaxWrapper          model.TaxWrapperType
	Institution         *string
	AccountNumber       *string
	Currency            *string
	SyncProvider        *string
	OwnershipPercentage *decimal.Decimal
	CoOwnerName         *string
	CoOwnerUserID       *string
}

// UpdateAccountInput holds the input parameters for updating an existing Account
type UpdateAccountInput struct {
	Name                *string
	Type                *model.AccountType
	TaxWrapper          *model.TaxWrapperType
	Institution         *string
	AccountNumber       *string
	Currency            *string
	OwnershipPercentage *decimal.Decimal
	CoOwnerName         *string
	CoOwnerUserID       *string
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

	// 1. Verify that the portfolio belongs to this user (or user is admin)
	pf, err := s.uow.Portfolio().GetByID(ctx, input.PortfolioID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrPortfolioNotFound
		}
		return nil, fmt.Errorf("failed to retrieve portfolio: %w", err)
	}
	callerUser, _ := s.uow.User().GetByID(ctx, userID)
	isAdmin := callerUser != nil && callerUser.IsAdmin()
	if pf.UserID != userID && !isAdmin {
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

	ownershipPercentage := decimal.NewFromInt(100)
	if input.OwnershipPercentage != nil && !input.OwnershipPercentage.IsZero() {
		ownershipPercentage = *input.OwnershipPercentage
	}

	var coOwnerName *string
	if input.CoOwnerName != nil && strings.TrimSpace(*input.CoOwnerName) != "" {
		trimmed := strings.TrimSpace(*input.CoOwnerName)
		coOwnerName = &trimmed
	}

	var coOwnerUserID *string
	if input.CoOwnerUserID != nil && strings.TrimSpace(*input.CoOwnerUserID) != "" {
		trimmed := strings.TrimSpace(*input.CoOwnerUserID)
		coOwnerUserID = &trimmed
	}

	if ownershipPercentage.Equal(decimal.NewFromInt(100)) {
		coOwnerName = nil
		coOwnerUserID = nil
	}

	now := time.Now()
	account := &model.Account{
		UserID:              userID,
		PortfolioID:         input.PortfolioID,
		Name:                strings.TrimSpace(input.Name),
		Type:                accountType,
		TaxWrapper:          taxWrapper,
		Institution:         input.Institution,
		AccountNumber:       input.AccountNumber,
		Currency:            currency,
		SyncProvider:        syncProvider,
		OwnershipPercentage: ownershipPercentage,
		CoOwnerName:         coOwnerName,
		CoOwnerUserID:       coOwnerUserID,
		CreatedAt:           now,
		UpdatedAt:           now,
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

// GetAccount retrieves an account by ID, verifying user ownership (or admin role)
func (s *AccountService) GetAccount(ctx context.Context, userID, accountID string) (*model.Account, error) {
	acc, err := s.uow.Account().GetByID(ctx, accountID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrAccountNotFound
		}
		return nil, err
	}
	callerUser, _ := s.uow.User().GetByID(ctx, userID)
	isAdmin := callerUser != nil && callerUser.IsAdmin()
	if acc.UserID != userID && !isAdmin {
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
	callerUser, _ := s.uow.User().GetByID(ctx, userID)
	isAdmin := callerUser != nil && callerUser.IsAdmin()
	if pf.UserID != userID && !isAdmin {
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

	var ownershipChanged bool
	var newOwnership decimal.Decimal
	if input.OwnershipPercentage != nil {
		acc.OwnershipPercentage = *input.OwnershipPercentage
		ownershipChanged = true
		newOwnership = *input.OwnershipPercentage
	}

	if input.CoOwnerName != nil {
		if strings.TrimSpace(*input.CoOwnerName) == "" {
			acc.CoOwnerName = nil
		} else {
			trimmed := strings.TrimSpace(*input.CoOwnerName)
			acc.CoOwnerName = &trimmed
		}
	}

	if input.CoOwnerUserID != nil {
		if strings.TrimSpace(*input.CoOwnerUserID) == "" {
			acc.CoOwnerUserID = nil
		} else {
			trimmed := strings.TrimSpace(*input.CoOwnerUserID)
			acc.CoOwnerUserID = &trimmed
		}
	}

	if acc.OwnershipPercentage.Equal(decimal.NewFromInt(100)) {
		acc.CoOwnerName = nil
		acc.CoOwnerUserID = nil
	}

	acc.UpdatedAt = time.Now()

	if err := acc.Validate(); err != nil {
		return nil, err
	}

	err = s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		if err := uow.Account().Update(ctx, acc); err != nil {
			return fmt.Errorf("failed to update account: %w", err)
		}
		if ownershipChanged {
			if err := uow.Position().UpdateOwnershipByAccount(ctx, acc.ID, newOwnership); err != nil {
				return fmt.Errorf("failed to cascade ownership to positions: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return acc, nil
}

// DeleteAccount removes an account if it belongs to the user, cleaning up linked sync connections and credentials.
func (s *AccountService) DeleteAccount(ctx context.Context, userID, accountID string) error {
	acc, err := s.GetAccount(ctx, userID, accountID)
	if err != nil {
		return err
	}

	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// Clean up sync connection linked to this account, and any orphaned connections
		var credID string
		conn, err := uow.Sync().GetConnectionByAccountID(ctx, acc.ID)
		if err == nil && conn != nil {
			credID = conn.CredentialID
			_ = uow.Sync().DeleteConnection(ctx, conn.ID)
		} else if acc.SyncProvider != "" && acc.SyncProvider != "MANUAL" {
			if cred, credErr := uow.Sync().GetCredentialByProvider(ctx, userID, acc.SyncProvider); credErr == nil && cred != nil {
				credID = cred.ID
			}
		}

		// Clean up orphaned connections in this portfolio
		conns, listErr := uow.Sync().ListConnectionsByPortfolio(ctx, acc.PortfolioID)
		if listErr == nil {
			hasOther := false
			for _, c := range conns {
				if c.AccountID == nil || *c.AccountID == "" || *c.AccountID == acc.ID {
					_ = uow.Sync().DeleteConnection(ctx, c.ID)
					continue
				}
				if credID != "" && c.CredentialID == credID {
					hasOther = true
				}
			}
			if !hasOther && credID != "" {
				_ = uow.Sync().DeleteCredential(ctx, credID)
			}
		} else if credID != "" {
			_ = uow.Sync().DeleteCredential(ctx, credID)
		}

		return uow.Account().Delete(ctx, acc.ID)
	})
}
